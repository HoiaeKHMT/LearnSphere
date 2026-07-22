import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient, getBedrockConfig } from "../config/bedrock.js";

const createAIError = (code, cause) => {
	const error = new Error(code);
	error.cause = cause;
	return error;
};

const getProviderTimeoutMs = () => {
	const configured = Number(process.env.AI_PROVIDER_TIMEOUT_MS);
	return Number.isInteger(configured) && configured >= 15000 && configured <= 300000
		? configured
		: 120000;
};

const mapBedrockError = (error) => {
	const statusCode = error?.$metadata?.httpStatusCode;
	const errorName = error?.name;

	if (errorName === "ThrottlingException" || statusCode === 429) return createAIError("AI_THROTTLED", error);
	if (errorName === "AccessDeniedException" || statusCode === 403) return createAIError("AI_ACCESS_DENIED", error);
	if (
		errorName === "ValidationException" ||
		errorName === "ResourceNotFoundException" ||
		statusCode === 400 ||
		statusCode === 404
	) {
		return createAIError("AI_CONFIGURATION_ERROR", error);
	}
	if (errorName === "CredentialsProviderError" || errorName === "UnrecognizedClientException") {
		return createAIError("AI_CREDENTIALS_ERROR", error);
	}

	return createAIError("AI_SERVICE_UNAVAILABLE", error);
};

const invokeBedrock = async ({ systemPrompt, messages, maxTokens, temperature }) => {
	const { modelId } = getBedrockConfig();
	const command = new ConverseCommand({
		modelId,
		system: [{ text: systemPrompt }],
		messages,
		inferenceConfig: { maxTokens, temperature, topP: 0.9 },
	});

	try {
		const response = await getBedrockClient().send(command);
		const text = response.output?.message?.content
			?.map((block) => block.text || "")
			.join("")
			.trim();
		if (!text) throw createAIError("AI_EMPTY_RESPONSE");

		return {
			text,
			model_id: modelId,
			stop_reason: response.stopReason,
			usage: response.usage
				? {
					input_tokens: response.usage.inputTokens ?? 0,
					output_tokens: response.usage.outputTokens ?? 0,
					total_tokens: response.usage.totalTokens ?? 0,
				}
				: null,
		};
	} catch (error) {
		if (error.message === "AI_EMPTY_RESPONSE") throw error;
		throw mapBedrockError(error);
	}
};

const getGroqConfig = () => {
	const apiKey = process.env.GROQ_API_KEY?.trim();
	if (!apiKey) throw createAIError("AI_CREDENTIALS_ERROR");

	return {
		apiKey,
		modelId: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
		baseUrl: "https://api.groq.com/openai/v1/chat/completions",
	};
};

const getMessageText = (message) => message.content
	.map((block) => block.text || "")
	.join("")
	.trim();

const mapGroqError = (status, body, cause) => {
	const providerError = new Error(body?.error?.message || `Groq request failed with status ${status}`);
	providerError.status = status;
	providerError.cause = cause;

	if (status === 429) return createAIError("AI_THROTTLED", providerError);
	if (status === 401) return createAIError("AI_CREDENTIALS_ERROR", providerError);
	if (status === 403) return createAIError("AI_ACCESS_DENIED", providerError);
	if (status === 413) return createAIError("AI_CONTEXT_TOO_LARGE", providerError);
	if (status === 400 || status === 404 || status === 422) return createAIError("AI_CONFIGURATION_ERROR", providerError);
	return createAIError("AI_SERVICE_UNAVAILABLE", providerError);
};

const invokeGroq = async ({ systemPrompt, messages, maxTokens, temperature }) => {
	const { apiKey, modelId, baseUrl } = getGroqConfig();
	const requestMessages = [
		{ role: "system", content: systemPrompt },
		...messages.map((message) => ({ role: message.role, content: getMessageText(message) })),
	];

	let response;
	try {
		response = await fetch(baseUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: modelId,
				messages: requestMessages,
				max_tokens: maxTokens,
				temperature,
				top_p: 0.9,
			}),
			signal: AbortSignal.timeout(getProviderTimeoutMs()),
		});
	} catch (error) {
		if (error?.name === "TimeoutError" || error?.name === "AbortError") {
			throw createAIError("AI_TIMEOUT", error);
		}
		throw createAIError("AI_SERVICE_UNAVAILABLE", error);
	}

	let body;
	try {
		body = await response.json();
	} catch (error) {
		throw createAIError("AI_SERVICE_UNAVAILABLE", error);
	}
	if (!response.ok) throw mapGroqError(response.status, body);

	const text = body.choices?.[0]?.message?.content?.trim();
	if (!text) throw createAIError("AI_EMPTY_RESPONSE");

	return {
		text,
		model_id: body.model || modelId,
		stop_reason: body.choices?.[0]?.finish_reason || "",
		usage: body.usage
			? {
				input_tokens: body.usage.prompt_tokens ?? 0,
				output_tokens: body.usage.completion_tokens ?? 0,
				total_tokens: body.usage.total_tokens ?? 0,
			}
			: null,
	};
};

export const getAIProvider = () => process.env.AI_PROVIDER?.trim().toLowerCase() || "bedrock";

export const invokeAI = async (request) => {
	const provider = getAIProvider();
	if (provider === "bedrock") return invokeBedrock(request);
	if (provider === "groq") return invokeGroq(request);
	throw createAIError("AI_CONFIGURATION_ERROR", new Error(`Unsupported AI_PROVIDER: ${provider}`));
};
