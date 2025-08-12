/**
 * Utility functions for content analysis
 * Used for extracting hashtags and mentions from text content
 */

/**
 * Extract hashtags from text content
 * @param {string} text - The text content to analyze
 * @returns {string[]} Array of hashtags found in the text
 */
export const extractHashtags = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Regex to match hashtags: #word or #word123 or #word_with_underscores
  const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
  const hashtags = text.match(hashtagRegex);

  if (!hashtags) {
    return [];
  }

  // Remove the # symbol and return unique hashtags
  return [...new Set(hashtags.map(tag => tag.slice(1)))];
};

/**
 * Extract mentions from text content
 * @param {string} text - The text content to analyze
 * @returns {string[]} Array of usernames mentioned in the text
 */
export const extractMentions = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Regex to match mentions: @username or @user_name or @user123
  const mentionRegex = /@[\w\u0590-\u05ff]+/g;
  const mentions = text.match(mentionRegex);

  if (!mentions) {
    return [];
  }

  // Remove the @ symbol and return unique mentions
  return [...new Set(mentions.map(mention => mention.slice(1)))];
};

/**
 * Extract URLs from text content
 * @param {string} text - The text content to analyze
 * @returns {string[]} Array of URLs found in the text
 */
export const extractUrls = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Regex to match URLs: http://, https://, www., etc.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const urls = text.match(urlRegex);

  return urls || [];
};

/**
 * Extract email addresses from text content
 * @param {string} text - The text content to analyze
 * @returns {string[]} Array of email addresses found in the text
 */
export const extractEmails = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Regex to match email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex);

  return emails || [];
};

/**
 * Extract phone numbers from text content
 * @param {string} text - The text content to analyze
 * @returns {string[]} Array of phone numbers found in the text
 */
export const extractPhoneNumbers = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Regex to match phone numbers (various formats)
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = text.match(phoneRegex);

  return phones || [];
};

/**
 * Clean text by removing special characters and normalizing whitespace
 * @param {string} text - The text to clean
 * @returns {string} Cleaned text
 */
export const cleanText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim(); // Remove leading/trailing whitespace
};

/**
 * Count words in text content
 * @param {string} text - The text content to analyze
 * @returns {number} Word count
 */
export const countWords = (text) => {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Split by whitespace and filter out empty strings
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
};

/**
 * Count characters in text content (with and without spaces)
 * @param {string} text - The text content to analyze
 * @returns {Object} Object with character counts
 */
export const countCharacters = (text) => {
  if (!text || typeof text !== 'string') {
    return { total: 0, withoutSpaces: 0 };
  }

  return {
    total: text.length,
    withoutSpaces: text.replace(/\s/g, '').length,
  };
};

/**
 * Get reading time estimate for text content
 * @param {string} text - The text content to analyze
 * @param {number} wordsPerMinute - Average reading speed (default: 200)
 * @returns {number} Estimated reading time in minutes
 */
export const getReadingTime = (text, wordsPerMinute = 200) => {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const wordCount = countWords(text);
  return Math.ceil(wordCount / wordsPerMinute);
};

/**
 * Check if text contains inappropriate content (basic implementation)
 * @param {string} text - The text content to check
 * @param {string[]} inappropriateWords - Array of inappropriate words to check for
 * @returns {Object} Object with flag and found words
 */
export const checkInappropriateContent = (text, inappropriateWords = []) => {
  if (!text || typeof text !== 'string') {
    return { hasInappropriateContent: false, foundWords: [] };
  }

  const lowerText = text.toLowerCase();
  const foundWords = inappropriateWords.filter(word => 
    lowerText.includes(word.toLowerCase())
  );

  return {
    hasInappropriateContent: foundWords.length > 0,
    foundWords,
  };
};

/**
 * Generate a summary of text content
 * @param {string} text - The text content to summarize
 * @param {number} maxLength - Maximum length of summary
 * @returns {string} Text summary
 */
export const generateSummary = (text, maxLength = 150) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  // Find the last complete word within the limit
  const truncated = text.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex === -1) {
    return truncated + '...';
  }

  return truncated.substring(0, lastSpaceIndex) + '...';
};

/**
 * Extract key phrases from text content
 * @param {string} text - The text content to analyze
 * @param {number} minLength - Minimum phrase length
 * @param {number} maxLength - Maximum phrase length
 * @returns {string[]} Array of key phrases
 */
export const extractKeyPhrases = (text, minLength = 3, maxLength = 6) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  const phrases = [];

  sentences.forEach(sentence => {
    const words = sentence.trim().split(/\s+/).filter(word => word.length > 0);
    
    // Generate phrases of different lengths
    for (let i = 0; i <= words.length - minLength; i++) {
      for (let j = minLength; j <= Math.min(maxLength, words.length - i); j++) {
        const phrase = words.slice(i, i + j).join(' ').toLowerCase();
        if (phrase.length > 0) {
          phrases.push(phrase);
        }
      }
    }
  });

  // Return unique phrases
  return [...new Set(phrases)];
};

/**
 * Calculate text sentiment score (basic implementation)
 * @param {string} text - The text content to analyze
 * @param {Object} positiveWords - Object with positive words and their scores
 * @param {Object} negativeWords - Object with negative words and their scores
 * @returns {number} Sentiment score between -1 and 1
 */
export const calculateSentiment = (text, positiveWords = {}, negativeWords = {}) => {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const words = text.toLowerCase().split(/\s+/);
  let positiveScore = 0;
  let negativeScore = 0;

  words.forEach(word => {
    if (positiveWords[word]) {
      positiveScore += positiveWords[word];
    }
    if (negativeWords[word]) {
      negativeScore += negativeWords[word];
    }
  });

  const totalScore = positiveScore - negativeScore;
  const maxScore = Math.max(positiveScore, negativeScore);

  if (maxScore === 0) {
    return 0;
  }

  return Math.max(-1, Math.min(1, totalScore / maxScore));
};

/**
 * Extract language indicators from text
 * @param {string} text - The text content to analyze
 * @returns {string} Detected language code or 'unknown'
 */
export const detectLanguage = (text) => {
  if (!text || typeof text !== 'string') {
    return 'unknown';
  }

  // Basic language detection based on character sets
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF]/.test(text);
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  const hasKorean = /[\uAC00-\uD7AF]/.test(text);
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  const hasThai = /[\u0E00-\u0E7F]/.test(text);
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);

  if (hasArabic) return 'ar';
  if (hasChinese) return 'zh';
  if (hasJapanese) return 'ja';
  if (hasKorean) return 'ko';
  if (hasHebrew) return 'he';
  if (hasThai) return 'th';
  if (hasCyrillic) return 'ru';

  // Default to English for Latin script
  return 'en';
};

/**
 * Format text for display (add line breaks, etc.)
 * @param {string} text - The text content to format
 * @returns {string} Formatted text
 */
export const formatTextForDisplay = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\n/g, '<br>') // Convert newlines to HTML line breaks
    .replace(/\s{2,}/g, '&nbsp;&nbsp;') // Convert multiple spaces to non-breaking spaces
    .trim();
};

/**
 * Remove HTML tags from text
 * @param {string} text - The text content to clean
 * @returns {string} Text without HTML tags
 */
export const removeHtmlTags = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text.replace(/<[^>]*>/g, '');
};

/**
 * Escape HTML special characters
 * @param {string} text - The text content to escape
 * @returns {string} Escaped text
 */
export const escapeHtml = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
};
