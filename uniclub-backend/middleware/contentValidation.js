/**
 * Content validation and moderation middleware
 * Filters inappropriate content and enforces content policies
 */

// Simple profanity filter (in production, use a more comprehensive solution)
const bannedWords = [
  'spam', 'scam', 'fake', 'virus', 'malware', 'hack', 'phishing',
  // Add more as needed
];

// Spam patterns
const spamPatterns = [
  /(.)\1{4,}/g, // Repeated characters (e.g., "aaaaa")
  /https?:\/\/[^\s]+/g, // Multiple URLs
  /\b\d{10,}\b/g, // Long number sequences (potential phone numbers)
  /[A-Z]{10,}/g, // Excessive caps
];

const validateContent = (req, res, next) => {
  const { content } = req.body;
  
  if (!content) {
    return next(); // Skip validation if no content
  }

  const lowerContent = content.toLowerCase();
  
  // Check for banned words
  const containsBannedWords = bannedWords.some(word => 
    lowerContent.includes(word.toLowerCase())
  );
  
  if (containsBannedWords) {
    return res.status(400).json({
      error: 'Content contains inappropriate language',
      code: 'CONTENT_INAPPROPRIATE'
    });
  }
  
  // Check for spam patterns
  const isSpammy = spamPatterns.some(pattern => pattern.test(content));
  
  if (isSpammy) {
    return res.status(400).json({
      error: 'Content appears to be spam',
      code: 'CONTENT_SPAM'
    });
  }
  
  // Check content length
  if (content.length > 2000) {
    return res.status(400).json({
      error: 'Content is too long (maximum 2000 characters)',
      code: 'CONTENT_TOO_LONG'
    });
  }
  
  // Check for excessive links
  const urlCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
  if (urlCount > 3) {
    return res.status(400).json({
      error: 'Too many links in content',
      code: 'TOO_MANY_LINKS'
    });
  }
  
  next();
};

const validateMediaFiles = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }
  
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const maxFileSize = 50 * 1024 * 1024; // 50MB
  const maxImageSize = 10 * 1024 * 1024; // 10MB for images
  
  for (const file of req.files) {
    // Check file type
    if (!allowedImageTypes.includes(file.mimetype) && !allowedVideoTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type. Only images and videos are allowed.',
        code: 'INVALID_FILE_TYPE'
      });
    }
    
    // Check file size
    const sizeLimit = file.mimetype.startsWith('video/') ? maxFileSize : maxImageSize;
    if (file.size > sizeLimit) {
      return res.status(400).json({
        error: `File too large. Maximum size is ${sizeLimit / (1024 * 1024)}MB`,
        code: 'FILE_TOO_LARGE'
      });
    }
  }
  
  // Limit number of files
  if (req.files.length > 5) {
    return res.status(400).json({
      error: 'Too many files. Maximum 5 files per post.',
      code: 'TOO_MANY_FILES'
    });
  }
  
  next();
};

const sanitizeContent = (req, res, next) => {
  if (req.body.content) {
    // Remove potentially dangerous HTML tags and scripts
    req.body.content = req.body.content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .trim();
  }
  
  next();
};

module.exports = {
  validateContent,
  validateMediaFiles,
  sanitizeContent
};
