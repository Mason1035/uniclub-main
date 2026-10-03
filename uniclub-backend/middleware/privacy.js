const User = require('../models/User');
const Follow = require('../models/Follow');

/**
 * Privacy middleware for controlling access to content and user data
 */

const checkPostPrivacy = async (req, res, next) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const SocialPost = require('../models/SocialPost');
    const post = await SocialPost.findById(postId).populate('author');
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Post author can always access their own posts
    if (post.author._id.toString() === userId) {
      req.post = post;
      return next();
    }
    
    // Check visibility rules
    switch (post.visibility) {
      case 'public':
        // Anyone can see public posts
        break;
        
      case 'club-members':
        // Only enrolled club members can see
        const user = await User.findById(userId);
        if (!user || !user.isEnrolled) {
          return res.status(403).json({ error: 'Access denied: Club members only' });
        }
        break;
        
      case 'friends':
        // Only followed users can see
        const isFollowing = await Follow.findOne({
          followerId: userId,
          followingId: post.author._id,
          status: 'accepted'
        });
        
        if (!isFollowing) {
          return res.status(403).json({ error: 'Access denied: Friends only' });
        }
        break;
        
        
      case 'private':
        // Only the author can see private posts
        return res.status(403).json({ error: 'Access denied: Private post' });
        
      default:
        return res.status(403).json({ error: 'Access denied: Invalid visibility setting' });
    }
    
    req.post = post;
    next();
    
  } catch (error) {
    console.error('Error checking post privacy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const checkUserProfilePrivacy = async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.params;
    const requestingUserId = req.user?.userId;
    
    if (!requestingUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Users can always view their own profile
    if (targetUserId === requestingUserId) {
      return next();
    }
    
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check privacy settings
    switch (targetUser.settings?.profileVisibility) {
      case 'public':
        // Anyone can view
        break;
        
      case 'club-members':
        // Only enrolled club members can view
        const requestingUser = await User.findById(requestingUserId);
        if (!requestingUser || !requestingUser.isEnrolled) {
          return res.status(403).json({ error: 'Access denied: Club members only' });
        }
        break;
        
      case 'friends':
        // Only followed users can view
        const isFollowing = await Follow.findOne({
          followerId: requestingUserId,
          followingId: targetUserId,
          status: 'accepted'
        });
        
        if (!isFollowing) {
          return res.status(403).json({ error: 'Access denied: Friends only' });
        }
        break;
        
      case 'private':
        // Only the user themselves can view
        return res.status(403).json({ error: 'Access denied: Private profile' });
        
      default:
        // Default to club-members for safety
        const defaultUser = await User.findById(requestingUserId);
        if (!defaultUser || !defaultUser.isEnrolled) {
          return res.status(403).json({ error: 'Access denied' });
        }
    }
    
    req.targetUser = targetUser;
    next();
    
  } catch (error) {
    console.error('Error checking user profile privacy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const blockUnauthorizedActions = async (req, res, next) => {
  try {
    const { targetUserId } = req.params;
    const requestingUserId = req.user?.userId;
    
    if (!requestingUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if the requesting user has been blocked
    const blockRelationship = await Follow.findOne({
      followerId: requestingUserId,
      followingId: targetUserId,
      status: 'blocked'
    });
    
    if (blockRelationship) {
      return res.status(403).json({ error: 'Action not allowed: User blocked' });
    }
    
    // Check if the target user has blocked the requesting user
    const reverseBlockRelationship = await Follow.findOne({
      followerId: targetUserId,
      followingId: requestingUserId,
      status: 'blocked'
    });
    
    if (reverseBlockRelationship) {
      return res.status(403).json({ error: 'Action not allowed: You are blocked' });
    }
    
    next();
    
  } catch (error) {
    console.error('Error checking block status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const requireClubMembership = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await User.findById(userId);
    if (!user || !user.isEnrolled) {
      return res.status(403).json({ 
        error: 'Access denied: AI Club membership required' 
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Error checking club membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  checkPostPrivacy,
  checkUserProfilePrivacy,
  blockUnauthorizedActions,
  requireClubMembership
};
