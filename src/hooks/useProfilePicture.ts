import { useUser } from '../context/userContextState';

export const useProfilePicture = () => {
  const { user } = useUser();

  // Simple function to get avatar URL
  const getAvatarUrl = (): string | null => {
    // Only return Base64 data URLs, reject any file paths
    if (user?.profileImage && 
        typeof user.profileImage === 'string' && 
        user.profileImage.startsWith('data:')) {
      return user.profileImage;
    }
    return null;
  };

  return {
    avatarUrl: getAvatarUrl(),
    hasAvatar: !!getAvatarUrl()
  };
}; 