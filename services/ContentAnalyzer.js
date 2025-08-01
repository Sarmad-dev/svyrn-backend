import ContentScore from '../models/ContentScore.js';
import UserInteraction from '../models/UserInteraction.js';

class ContentAnalyzer {
  constructor() {
    this.qualityFactors = {
      textLength: { min: 50, optimal: 200, max: 1000 },
      mediaQuality: { minResolution: 480, optimalResolution: 1080 },
      engagementVelocity: { threshold: 0.1 }, // Engagement rate per hour
      diversityBonus: 0.2 // Bonus for diverse content
    };
  }

  // Analyze and score content
  async analyzeContent(contentType, contentId, content) {
    try {
      const metrics = await this.calculateMetrics(contentType, contentId);
      const qualityScore = this.calculateQualityScore(content);
      const engagementScore = this.calculateEngagementScore(metrics);
      const popularityScore = this.calculatePopularityScore(metrics);
      const viralityScore = this.calculateViralityScore(metrics);
      const recencyScore = this.calculateRecencyScore(content.createdAt);

      const contentScore = await ContentScore.findOneAndUpdate(
        { contentType, contentId },
        {
          contentType,
          contentId,
          author: content.author,
          scores: {
            quality: qualityScore,
            engagement: engagementScore,
            popularity: popularityScore,
            virality: viralityScore,
            recency: recencyScore,
            relevance: await this.calculateRelevanceScore(content),
            diversity: this.calculateDiversityScore(content)
          },
          metrics,
          lastCalculated: new Date()
        },
        { upsert: true, new: true }
      );

      return contentScore;
    } catch (error) {
      console.error('Content analysis error:', error);
      return null;
    }
  }

  // Calculate content metrics from interactions
  async calculateMetrics(contentType, contentId) {
    const interactions = await UserInteraction.find({
      targetType: contentType,
      targetId: contentId
    });

    const metrics = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      clickThroughRate: 0,
      avgDwellTime: 0,
      bounceRate: 0
    };

    let totalDwellTime = 0;
    let dwellTimeCount = 0;
    let bounces = 0;

    for (const interaction of interactions) {
      switch (interaction.interactionType) {
        case 'view':
          metrics.views++;
          if (interaction.metadata.dwellTime) {
            totalDwellTime += interaction.metadata.dwellTime;
            dwellTimeCount++;
            if (interaction.metadata.dwellTime < 3) { // Less than 3 seconds = bounce
              bounces++;
            }
          }
          break;
        case 'like':
          metrics.likes++;
          break;
        case 'comment':
          metrics.comments++;
          break;
        case 'share':
          metrics.shares++;
          break;
        case 'save':
          metrics.saves++;
          break;
        case 'click':
          metrics.clickThroughRate++;
          break;
      }
    }

    // Calculate derived metrics
    if (dwellTimeCount > 0) {
      metrics.avgDwellTime = totalDwellTime / dwellTimeCount;
    }

    if (metrics.views > 0) {
      metrics.clickThroughRate = metrics.clickThroughRate / metrics.views;
      metrics.bounceRate = bounces / metrics.views;
    }

    return metrics;
  }

  // Calculate content quality score
  calculateQualityScore(content) {
    let score = 0.5; // Base score

    // Text quality
    if (content.content && content.content.text) {
      const textLength = content.content.text.length;
      const { min, optimal, max } = this.qualityFactors.textLength;
      
      if (textLength >= min && textLength <= max) {
        const lengthScore = textLength <= optimal 
          ? textLength / optimal 
          : 1 - ((textLength - optimal) / (max - optimal)) * 0.5;
        score += lengthScore * 0.3;
      }

      // Check for spam indicators
      const spamScore = this.detectSpam(content.content.text);
      score -= spamScore * 0.4;
    }

    // Media quality
    if (content.content && content.content.media && content.content.media.length > 0) {
      const mediaScore = this.assessMediaQuality(content.content.media);
      score += mediaScore * 0.4;
    }

    // Completeness score
    const completenessScore = this.calculateCompleteness(content);
    score += completenessScore * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  // Calculate engagement score
  calculateEngagementScore(metrics) {
    if (metrics.views === 0) return 0;

    const engagementActions = metrics.likes + metrics.comments + metrics.shares + metrics.saves;
    const engagementRate = engagementActions / metrics.views;
    
    // Normalize engagement rate (typical good engagement is 3-5%)
    const normalizedRate = Math.min(1, engagementRate / 0.05);
    
    // Factor in dwell time
    const dwellTimeBonus = Math.min(0.3, metrics.avgDwellTime / 30); // 30 seconds = max bonus
    
    return Math.min(1, normalizedRate + dwellTimeBonus);
  }

  // Calculate popularity score
  calculatePopularityScore(metrics) {
    // Weighted popularity based on different actions
    const weightedScore = 
      (metrics.views * 0.1) +
      (metrics.likes * 1) +
      (metrics.comments * 2) +
      (metrics.shares * 3) +
      (metrics.saves * 2.5);

    // Normalize based on typical high-performing content
    return Math.min(1, weightedScore / 1000);
  }

  // Calculate virality score
  calculateViralityScore(metrics) {
    if (metrics.views === 0) return 0;

    // Virality is primarily driven by shares and rapid engagement
    const shareRate = metrics.shares / metrics.views;
    const viralityIndicator = shareRate * 10; // Amplify share impact

    // Factor in engagement velocity (would need time-based data)
    const velocityBonus = this.calculateEngagementVelocity(metrics);
    
    return Math.min(1, viralityIndicator + velocityBonus);
  }

  // Calculate recency score with time decay
  calculateRecencyScore(createdAt) {
    const ageHours = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60);
    
    // Exponential decay: content loses 50% relevance every 24 hours
    return Math.exp(-ageHours / 24);
  }

  // Calculate topic relevance score
  async calculateRelevanceScore(content) {
    // This would integrate with trending topics, user interests, etc.
    // For now, return a base score
    return 0.5;
  }

  // Calculate content diversity score
  calculateDiversityScore(content) {
    let score = 0.5;

    // Content type diversity
    if (content.content.media && content.content.media.length > 0) {
      const mediaTypes = new Set(content.content.media.map(m => m.type));
      score += (mediaTypes.size - 1) * 0.1; // Bonus for mixed media
    }

    // Topic diversity (would need topic extraction)
    // For now, return base score
    return Math.min(1, score);
  }

  // Detect spam content
  detectSpam(text) {
    let spamScore = 0;

    // Excessive capitalization
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.3) spamScore += 0.3;

    // Excessive punctuation
    const punctRatio = (text.match(/[!?]{2,}/g) || []).length;
    if (punctRatio > 2) spamScore += 0.2;

    // Repetitive patterns
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = 1 - (uniqueWords.size / words.length);
    if (repetitionRatio > 0.5) spamScore += 0.4;

    // Common spam phrases
    const spamPhrases = ['click here', 'buy now', 'limited time', 'act fast', 'guaranteed'];
    const spamPhraseCount = spamPhrases.filter(phrase => 
      text.toLowerCase().includes(phrase)
    ).length;
    spamScore += spamPhraseCount * 0.1;

    return Math.min(1, spamScore);
  }

  // Assess media quality
  assessMediaQuality(media) {
    let score = 0.5;

    for (const item of media) {
      // File size indicators (larger usually means better quality)
      if (item.size) {
        if (item.type === 'image' && item.size > 500000) score += 0.1; // 500KB+
        if (item.type === 'video' && item.size > 5000000) score += 0.1; // 5MB+
      }

      // Duration for videos (optimal 30-120 seconds)
      if (item.type === 'video' && item.duration) {
        if (item.duration >= 30 && item.duration <= 120) {
          score += 0.2;
        }
      }
    }

    return Math.min(1, score / media.length);
  }

  // Calculate content completeness
  calculateCompleteness(content) {
    let score = 0;

    // Has text content
    if (content.content.text && content.content.text.length > 10) score += 0.3;

    // Has media
    if (content.content.media && content.content.media.length > 0) score += 0.3;

    // Has location
    if (content.location) score += 0.1;

    // Has tags
    if (content.tags && content.tags.length > 0) score += 0.1;

    // Author is verified
    if (content.author && content.author.isVerified) score += 0.2;

    return Math.min(1, score);
  }

  // Calculate engagement velocity (simplified)
  calculateEngagementVelocity(metrics) {
    // This would need time-series data to calculate properly
    // For now, return a base calculation
    const totalEngagement = metrics.likes + metrics.comments + metrics.shares;
    return Math.min(0.3, totalEngagement / 100);
  }

  // Batch analyze content
  async batchAnalyzeContent(contents) {
    const results = [];
    
    for (const content of contents) {
      const result = await this.analyzeContent(
        content.type || 'post',
        content._id,
        content
      );
      results.push(result);
    }

    return results;
  }
}

export default ContentAnalyzer;