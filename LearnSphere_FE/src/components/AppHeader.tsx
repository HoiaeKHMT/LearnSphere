import { useEffect, useState } from 'react';
import { UserAvatarMenu } from './UserAvatarMenu';
import { api, type User } from '../services/api';

type AppHeaderProps = {
  avatarSrc: string;
  roleLabel: string;
  user?: User | null;
};

export function AppHeader({ avatarSrc, roleLabel, user }: AppHeaderProps) {
  const [resolvedAvatarSrc, setResolvedAvatarSrc] = useState(avatarSrc);

  useEffect(() => {
    let isActive = true;
    setResolvedAvatarSrc(avatarSrc);

    if (!user?.avatar_key) return () => { isActive = false; };

    api.getProfileAvatar()
      .then((result) => {
        if (isActive) setResolvedAvatarSrc(result.download_url);
      })
      .catch(() => {
        if (isActive) setResolvedAvatarSrc(avatarSrc);
      });

    return () => {
      isActive = false;
    };
  }, [avatarSrc, user?.avatar_key]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#414754] bg-[#0d131f]/95 backdrop-blur">
      <div className="flex h-16 w-full items-center justify-between px-4 md:px-8">
        <a className="text-[24px] font-bold text-[#adc7ff]" href="/dashboard">
          LearnSphere
        </a>
        <UserAvatarMenu name={user?.full_name ?? 'LearnSphere User'} role={roleLabel} avatarSrc={resolvedAvatarSrc} />
      </div>
    </header>
  );
}
