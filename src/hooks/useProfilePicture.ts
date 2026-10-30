import { useUser } from '../context/userContextState';

export const useProfilePicture = () => {
  const { user } = useUser();

  // Simple function to get avatar URL
  const getAvatarUrl = (): string | null => {
    // Accept the versioned same-origin avatar endpoint and legacy Base64 uploads.
    if (user?.profileImage && 
        typeof user.profileImage === 'string' && 
        (user.profileImage.startsWith('data:image/') || /^\/api\/users\/avatar\//.test(user.profileImage))) {
      return user.profileImage;
    }
    return null;
  };

  return {
    avatarUrl: getAvatarUrl(),
    hasAvatar: !!getAvatarUrl()
  };
}; 