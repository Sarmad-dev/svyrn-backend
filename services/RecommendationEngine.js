import Post from "../models/Post.js";
import User from "../models/User.js";
import UserInteraction from "../models/UserInteraction.js";
import UserPreference from "../models/UserPreference.js";
import ContentScore from "../models/ContentScore.js";
import ContentAnalyzer from "./ContentAnalyzer.js";

class RecommendationEngine {
  constructor() {
    this.weights = {
      social: 0.3, // Friend connections and social signals
      behavioral: 0.25, // User behavior patterns
      content: 0.2, // Content-based filtering
      location: 0.15, // Geographic relevance
      temporal: 0.1, // Time-based factors
    };
  }

  // Main recommendation method
  async getRecommendedFeed(userId, options = {}) {
    try {
      const {
        limit = 20,
        page = 1,
        includeAds = true,
        diversityFactor = 0.3,
        location = null,
      } = options;

      // Get user preferences and context
      const userContext = await this.getUserContext(userId, location);

      // Get candidate posts
      const candidates = await this.getCandidatePosts(userId, userContext);

      // Score and rank posts
      const scoredPosts = await this.scoreAndRankPosts(candidates, userContext);

      // Apply diversity and filtering
      const diversifiedPosts = this.applyDiversityFilter(
        scoredPosts,
        diversityFactor
      );

      // Paginate results
      const skip = (page - 1) * limit;
      const recommendedPosts = diversifiedPosts.slice(skip, skip + limit);

      // Track recommendations for learning
      await this.trackRecommendations(userId, recommendedPosts);

      return {
        posts: recommendedPosts,
        metadata: {
          totalCandidates: candidates.length,
          scoringFactors: userContext.preferences,
          diversityApplied: diversityFactor,
          page,
          limit,
        },
      };
    } catch (error) {
      console.error("Recommendation engine error:", error);
      // Fallback to chronological feed
      return this.getFallbackFeed(userId, options);
    }
  }

  // Get user context for recommendations
  async getUserContext(userId, location = null) {
    const user = await User.findById(userId)
      .populate("following", "_id")
      .populate("followers", "_id");

    let preferences = await UserPreference.findOne({ user: userId });
    if (!preferences) {
      preferences = await this.initializeUserPreferences(userId);
    }

    // Get recent interactions
    const recentInteractions = await UserInteraction.find({
      user: userId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    })
      .sort({ createdAt: -1 })
      .limit(1000);

    // Get current time context
    const now = new Date();
    const timeContext = {
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
    };

    return {
      user,
      preferences,
      recentInteractions,
      timeContext,
      location: location || (await this.getUserLocation(userId)),
      socialGraph: {
        following: user.following.map((f) => f._id),
        followers: user.followers.map((f) => f._id),
      },
    };
  }

  // Get candidate posts for recommendation
  async getCandidatePosts(userId, userContext) {
    const { socialGraph, preferences, location, timeContext } = userContext;

    // Time window for candidate posts (last 7 days)
    const timeWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const baseQuery = {
      isActive: true,
      createdAt: { $gte: timeWindow },
    };

    // Get posts from different sources
    const [friendsPosts, popularPosts, localPosts, topicPosts, trendingPosts] =
      await Promise.all([
        // Friends' posts
        this.getFriendsPosts(socialGraph.following, baseQuery, 100),

        // Popular posts
        this.getPopularPosts(baseQuery, 50),

        // Local posts
        this.getLocalPosts(location, baseQuery, 30),

        // Topic-based posts
        this.getTopicBasedPosts(
          preferences.contentPreferences.topics,
          baseQuery,
          40
        ),

        // Trending posts
        this.getTrendingPosts(baseQuery, 20),
      ]);

    // Combine and deduplicate
    const allPosts = [
      ...friendsPosts,
      ...popularPosts,
      ...localPosts,
      ...topicPosts,
      ...trendingPosts,
    ];

    // Remove duplicates and posts user has already interacted with
    const seenPostIds = new Set();
    const recentInteractionIds = new Set(
      userContext.recentInteractions
        .filter((i) => i.targetType === "post")
        .map((i) => i.targetId.toString())
    );

    return allPosts.filter((post) => {
      const postId = post._id.toString();
      if (seenPostIds.has(postId) || recentInteractionIds.has(postId)) {
        return false;
      }
      seenPostIds.add(postId);
      return true;
    });
  }

  // Score and rank posts based on user context
  async scoreAndRankPosts(posts, userContext) {
    const scoredPosts = [];

    for (const post of posts) {
      const score = await this.calculatePostScore(post, userContext);
      scoredPosts.push({
        post,
        score,
        factors: score.breakdown,
      });
    }

    return scoredPosts.sort((a, b) => b.score.total - a.score.total);
  }

  // Calculate comprehensive post score
  async calculatePostScore(post, userContext) {
    const {
      user,
      preferences,
      recentInteractions,
      timeContext,
      location,
      socialGraph,
    } = userContext;

    // Social score
    const socialScore = this.calculateSocialScore(
      post,
      socialGraph,
      preferences
    );

    // Behavioral score
    const behavioralScore = this.calculateBehavioralScore(
      post,
      recentInteractions,
      preferences
    );

    // Content score
    const contentScore = await this.calculateContentScore(post, preferences);

    // Location score
    const locationScore = this.calculateLocationScore(
      post,
      location,
      preferences
    );

    // Temporal score
    const temporalScore = this.calculateTemporalScore(
      post,
      timeContext,
      preferences
    );

    // Combine scores with weights
    const totalScore =
      socialScore * this.weights.social +
      behavioralScore * this.weights.behavioral +
      contentScore * this.weights.content +
      locationScore * this.weights.location +
      temporalScore * this.weights.temporal;

    return {
      total: Math.max(0, Math.min(1, totalScore)), // Normalize to 0-1
      breakdown: {
        social: socialScore,
        behavioral: behavioralScore,
        content: contentScore,
        location: locationScore,
        temporal: temporalScore,
      },
    };
  }

  // Calculate social relevance score
  calculateSocialScore(post, socialGraph, preferences) {
    let score = 0;

    // Author relationship
    const authorId = post.author._id.toString();
    if (socialGraph.following.includes(authorId)) {
      score += 0.8; // High score for followed users
    } else if (socialGraph.followers.includes(authorId)) {
      score += 0.6; // Medium score for followers
    }

    // Mutual connections
    const mutualConnections = this.getMutualConnections(
      post.author,
      socialGraph
    );
    score += Math.min(0.3, mutualConnections * 0.05);

    // Social proof (likes, comments from friends)
    const friendEngagement = this.getFriendEngagement(post, socialGraph);
    score += Math.min(0.4, friendEngagement * 0.1);

    // Apply user's social preference weight
    return score * preferences.socialPreferences.friendsWeight;
  }

  // Calculate behavioral relevance score
  calculateBehavioralScore(post, recentInteractions, preferences) {
    let score = 0;

    // Content type preference
    const postType = this.getPostType(post);
    const typePreference = preferences.contentPreferences.postTypes.find(
      (pt) => pt.type === postType
    );
    if (typePreference) {
      score += Math.max(0, typePreference.score) * 0.3;
    }

    // Topic affinity
    const postTopics = this.extractTopics(post);
    for (const topic of postTopics) {
      const topicPreference = preferences.contentPreferences.topics.find(
        (tp) => tp.keyword.toLowerCase() === topic.toLowerCase()
      );
      if (topicPreference) {
        score += Math.max(0, topicPreference.score) * 0.2;
      }
    }

    // Engagement pattern matching
    const authorInteractions = recentInteractions.filter(
      (i) =>
        i.targetType === "user" &&
        i.targetId.toString() === post.author._id.toString()
    );
    if (authorInteractions.length > 0) {
      const avgEngagement =
        authorInteractions.reduce((sum, i) => sum + i.value, 0) /
        authorInteractions.length;
      score += Math.min(0.5, avgEngagement * 0.1);
    }

    return Math.max(0, Math.min(1, score));
  }

  // Calculate content-based score
  async calculateContentScore(post, preferences) {
    let score = 0;

    // Get or calculate content scores
    let contentScore = await ContentScore.findOne({
      contentType: "post",
      contentId: post._id,
    });

    if (!contentScore) {
      contentScore = await this.calculateContentMetrics(post);
    }

    // Quality indicators
    score += contentScore.scores.quality * 0.3;
    score += contentScore.scores.engagement * 0.3;
    score += contentScore.scores.popularity * 0.2;

    // Content freshness
    const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
    const recencyScore = Math.exp(-ageHours / 24); // Exponential decay over 24 hours
    score += recencyScore * preferences.socialPreferences.recencyWeight * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  // Calculate location-based score
  calculateLocationScore(post, userLocation, preferences) {
    if (!userLocation || !post.location) {
      return 0.1; // Neutral score for posts without location
    }

    let score = 0;

    // Distance-based scoring
    const distance = this.calculateDistance(userLocation, post.location);
    if (distance < 10) {
      // Within 10km
      score += 0.8;
    } else if (distance < 50) {
      // Within 50km
      score += 0.6;
    } else if (distance < 200) {
      // Within 200km
      score += 0.3;
    }

    // City/region matching
    if (userLocation.city === post.location.name) {
      score += 0.5;
    }

    // Apply user's location preference weight
    return score * preferences.locationPreferences.localContentWeight;
  }

  // Calculate temporal relevance score
  calculateTemporalScore(post, timeContext, preferences) {
    let score = 0;

    // Time of day preference
    const userActiveHours = preferences.timePreferences.activeHours;
    const currentHourPref = userActiveHours.find(
      (ah) => ah.hour === timeContext.hour
    );
    if (currentHourPref) {
      score += Math.max(0, currentHourPref.activity) * 0.3;
    }

    // Day of week preference
    const userActiveDays = preferences.timePreferences.activeDays;
    const currentDayPref = userActiveDays.find(
      (ad) => ad.day === timeContext.dayOfWeek
    );
    if (currentDayPref) {
      score += Math.max(0, currentDayPref.activity) * 0.3;
    }

    // Content age penalty
    const ageHours = (Date.now() - post.createdAt) / (1000 * 60 * 60);
    const agePenalty = Math.max(0, 1 - ageHours / 168); // Decay over 1 week
    score += agePenalty * 0.4;

    return Math.max(0, Math.min(1, score));
  }

  // Apply diversity filter to avoid echo chambers
  applyDiversityFilter(scoredPosts, diversityFactor) {
    if (diversityFactor === 0) return scoredPosts;

    const diversifiedPosts = [];
    const seenAuthors = new Set();
    const seenTopics = new Set();
    const maxSameAuthor = Math.max(1, Math.floor(scoredPosts.length * 0.3));
    const maxSameTopic = Math.max(1, Math.floor(scoredPosts.length * 0.4));

    for (const scoredPost of scoredPosts) {
      const { post } = scoredPost;
      const authorId = post.author._id.toString();
      const postTopics = this.extractTopics(post);

      // Check author diversity
      const authorCount = Array.from(seenAuthors).filter(
        (id) => id === authorId
      ).length;
      if (authorCount >= maxSameAuthor) {
        // Apply diversity penalty
        scoredPost.score.total *= 1 - diversityFactor;
      }

      // Check topic diversity
      const topicOverlap = postTopics.filter((topic) =>
        seenTopics.has(topic)
      ).length;
      if (topicOverlap > 0) {
        scoredPost.score.total *=
          1 - (diversityFactor * topicOverlap) / postTopics.length;
      }

      diversifiedPosts.push(scoredPost);
      seenAuthors.add(authorId);
      postTopics.forEach((topic) => seenTopics.add(topic));
    }

    return diversifiedPosts.sort((a, b) => b.score.total - a.score.total);
  }

  // Track user interactions for learning
  async trackInteraction(
    userId,
    targetType,
    targetId,
    interactionType,
    metadata = {}
  ) {
    try {
      const interaction = new UserInteraction({
        user: userId,
        targetType,
        targetId,
        interactionType,
        metadata: {
          ...metadata,
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
        },
      });

      await interaction.save();

      // Update user preferences asynchronously
      this.updateUserPreferences(userId, interaction);
    } catch (error) {
      console.error("Error tracking interaction:", error);
    }
  }

  // Update user preferences based on interactions
  async updateUserPreferences(userId, interaction) {
    try {
      let preferences = await UserPreference.findOne({ user: userId });
      if (!preferences) {
        preferences = await this.initializeUserPreferences(userId);
      }

      // Update based on interaction type
      const weight = this.getInteractionWeight(interaction.interactionType);

      if (interaction.targetType === "post") {
        const post = await Post.findById(interaction.targetId);
        if (post) {
          // Update topic preferences
          const topics = this.extractTopics(post);
          for (const topic of topics) {
            const existingTopic = preferences.contentPreferences.topics.find(
              (t) => t.keyword.toLowerCase() === topic.toLowerCase()
            );

            if (existingTopic) {
              existingTopic.score += weight * 0.1;
              existingTopic.frequency += 1;
            } else {
              preferences.contentPreferences.topics.push({
                keyword: topic,
                score: weight * 0.1,
                frequency: 1,
              });
            }
          }

          // Update post type preferences
          const postType = this.getPostType(post);
          const existingType = preferences.contentPreferences.postTypes.find(
            (pt) => pt.type === postType
          );

          if (existingType) {
            existingType.score += weight * 0.05;
          } else {
            preferences.contentPreferences.postTypes.push({
              type: postType,
              score: weight * 0.05,
            });
          }
        }
      }

      // Update time preferences
      if (interaction.metadata.timeOfDay !== undefined) {
        const hourPref = preferences.timePreferences.activeHours.find(
          (ah) => ah.hour === interaction.metadata.timeOfDay
        );

        if (hourPref) {
          hourPref.activity += weight * 0.02;
        } else {
          preferences.timePreferences.activeHours.push({
            hour: interaction.metadata.timeOfDay,
            activity: weight * 0.02,
          });
        }
      }

      preferences.lastUpdated = new Date();
      await preferences.save();
    } catch (error) {
      console.error("Error updating user preferences:", error);
    }
  }

  // Track recommendations for learning and analytics
  async trackRecommendations(userId, recommendedPosts) {
    try {
      if (!recommendedPosts || recommendedPosts.length === 0) {
        return;
      }

      const trackingPromises = recommendedPosts.map(
        async (scoredPost, index) => {
          const { post, score } = scoredPost;

          // Track the recommendation delivery
          await this.trackInteraction(
            userId,
            "post",
            post._id,
            "recommendation_shown",
            {
              recommendationScore: score.total,
              feedPosition: index + 1,
              scoringFactors: score.breakdown,
              postAuthor: post.author._id.toString(),
              postType: this.getPostType(post),
              postAge:
                (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60), // Age in hours
              algorithm: "ml_recommendation",
            }
          );
        }
      );

      // Execute all tracking operations in parallel
      await Promise.all(trackingPromises);

      // Update user's recommendation history
      await this.updateRecommendationHistory(userId, recommendedPosts);
    } catch (error) {
      console.error("Error tracking recommendations:", error);
      // Don't throw error to avoid breaking the recommendation flow
    }
  }

  // Update user's recommendation history for learning
  async updateRecommendationHistory(userId, recommendedPosts) {
    try {

      let preferences = await UserPreference.findOne({ user: userId });
      if (!preferences) {
        preferences = await this.initializeUserPreferences(userId);
      }

      // Track recommendation patterns
      const currentHour = new Date().getHours();
      const currentDay = new Date().getDay();

      // Update time-based recommendation patterns
      const hourPref = preferences.timePreferences.activeHours.find(
        (ah) => ah.hour === currentHour
      );

      if (hourPref) {
        hourPref.activity += 0.01; // Small increment for recommendation delivery
      }

      const dayPref = preferences.timePreferences.activeDays.find(
        (ad) => ad.day === currentDay
      );

      if (dayPref) {
        dayPref.activity += 0.01;
      }

      // Track content type preferences based on recommendations shown
      const contentTypes = recommendedPosts.map((sp) =>
        this.getPostType(sp.post)
      );
      const typeCount = {};

      contentTypes.forEach((type) => {
        typeCount[type] = (typeCount[type] || 0) + 1;
      });

      // Update content type preferences slightly based on what was recommended
      Object.entries(typeCount).forEach(([type, count]) => {
        const existingType = preferences.contentPreferences.postTypes.find(
          (pt) => pt.type === type
        );

        if (existingType) {
          // Small positive adjustment for recommended content types
          existingType.score += (count / recommendedPosts.length) * 0.02;
        }
      });

      // Extract and update topic preferences from recommended posts
      const allTopics = [];
      recommendedPosts.forEach((sp) => {
        const topics = this.extractTopics(sp.post);
        allTopics.push(...topics);
      });

      // Count topic frequency in recommendations
      const topicCount = {};
      allTopics.forEach((topic) => {
        topicCount[topic] = (topicCount[topic] || 0) + 1;
      });

      // Update topic preferences based on recommendations
      Object.entries(topicCount).forEach(([topic, count]) => {
        const existingTopic = preferences.contentPreferences.topics.find(
          (t) => t.keyword.toLowerCase() === topic.toLowerCase()
        );

        if (existingTopic) {
          // Small increment for recommended topics
          existingTopic.score += (count / allTopics.length) * 0.01;
          existingTopic.frequency += count;
        } else if (preferences.contentPreferences.topics.length < 100) {
          // Add new topic if under limit
          preferences.contentPreferences.topics.push({
            keyword: topic,
            score: (count / allTopics.length) * 0.01,
            frequency: count,
          });
        }
      });

      preferences.lastUpdated = new Date();
      await preferences.save();
    } catch (error) {
      console.error("Error updating recommendation history:", error);
    }
  }

  // Get mutual connections between post author and user
  getMutualConnections(postAuthor, socialGraph) {
    if (!postAuthor.followers || !postAuthor.following) {
      return 0;
    }

    const authorFollowers = postAuthor.followers.map((f) => f.toString());
    const authorFollowing = postAuthor.following.map((f) => f.toString());
    const userConnections = [
      ...socialGraph.following.map((f) => f.toString()),
      ...socialGraph.followers.map((f) => f.toString()),
    ];

    // Find mutual followers and following
    const mutualFollowers = authorFollowers.filter((id) =>
      userConnections.includes(id)
    );
    const mutualFollowing = authorFollowing.filter((id) =>
      userConnections.includes(id)
    );

    // Return total mutual connections (avoid duplicates)
    const allMutual = new Set([...mutualFollowers, ...mutualFollowing]);
    return allMutual.size;
  }

  // Get friend engagement on a post
  getFriendEngagement(post, socialGraph) {
    let engagementCount = 0;

    // Check reactions from friends
    if (post.reactions) {
      engagementCount += post.reactions.filter(
        (reaction) =>
          socialGraph.following.includes(reaction.user.toString()) ||
          socialGraph.followers.includes(reaction.user.toString())
      ).length;
    }

    // Check comments from friends
    if (post.comments) {
      engagementCount += post.comments.filter(
        (comment) =>
          socialGraph.following.includes(comment.author.toString()) ||
          socialGraph.followers.includes(comment.author.toString())
      ).length;
    }

    // Check shares from friends
    if (post.shares) {
      engagementCount += post.shares.filter((share) =>
        socialGraph.following.includes(share.user.toString())
      ).length;
    }

    return engagementCount;
  }

  // Calculate content metrics for a post
  async calculateContentMetrics(post) {
    try {
      const contentAnalyzer = new ContentAnalyzer();

      // Use the ContentAnalyzer to analyze and score the post
      let contentScore = await contentAnalyzer.analyzeContent(
        "post",
        post._id,
        post
      );

      if (contentScore) {
        return contentScore;
      }

      // Fallback: create basic content score if analyzer fails
      const basicMetrics = {
        views: 0,
        likes: post.reactions ? post.reactions.length : 0,
        comments: post.comments ? post.comments.length : 0,
        shares: post.shares ? post.shares.length : 0,
        saves: 0,
        clickThroughRate: 0,
        avgDwellTime: 0,
        bounceRate: 0,
      };

      const basicScores = {
        quality: this.calculateBasicQualityScore(post),
        engagement: this.calculateBasicEngagementScore(basicMetrics),
        popularity: this.calculateBasicPopularityScore(basicMetrics),
        virality: this.calculateBasicViralityScore(basicMetrics),
        recency: this.calculateRecencyScore(post.createdAt),
        relevance: 0.5,
        diversity: 0.5,
      };

      // Create and return a basic ContentScore object
      contentScore = await ContentScore.create({
        contentType: "post",
        contentId: post._id,
        author: post.author,
        scores: basicScores,
        metrics: basicMetrics,
        lastCalculated: new Date(),
      });

      return contentScore;
    } catch (error) {
      console.error("Error calculating content metrics:", error);

      // Return minimal fallback score
      return {
        scores: {
          quality: 0.5,
          engagement: 0.5,
          popularity: 0.5,
          virality: 0.5,
          recency: this.calculateRecencyScore(post.createdAt),
          relevance: 0.5,
          diversity: 0.5,
        },
        metrics: {
          views: 0,
          likes: post.reactions ? post.reactions.length : 0,
          comments: post.comments ? post.comments.length : 0,
          shares: post.shares ? post.shares.length : 0,
          saves: 0,
          clickThroughRate: 0,
          avgDwellTime: 0,
          bounceRate: 0,
        },
      };
    }
  }

  // Calculate basic quality score for fallback
  calculateBasicQualityScore(post) {
    let score = 0.5; // Base score

    // Text content quality
    if (post.content && post.content.text) {
      const textLength = post.content.text.length;
      if (textLength >= 50 && textLength <= 1000) {
        score += 0.2;
      }

      // Check for complete sentences
      const sentences = post.content.text
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 0);
      if (sentences.length >= 2) {
        score += 0.1;
      }
    }

    // Media content bonus
    if (post.content && post.content.media && post.content.media.length > 0) {
      score += 0.2;
    }

    // Location bonus
    if (post.location) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  // Calculate basic engagement score for fallback
  calculateBasicEngagementScore(metrics) {
    if (metrics.views === 0) return 0;

    const engagementActions =
      metrics.likes + metrics.comments + metrics.shares + metrics.saves;
    const engagementRate = engagementActions / Math.max(1, metrics.views);

    // Normalize engagement rate (typical good engagement is 3-5%)
    return Math.min(1, engagementRate / 0.05);
  }

  // Calculate basic popularity score for fallback
  calculateBasicPopularityScore(metrics) {
    const weightedScore =
      metrics.views * 0.1 +
      metrics.likes * 1 +
      metrics.comments * 2 +
      metrics.shares * 3 +
      metrics.saves * 2.5;

    // Normalize based on typical high-performing content
    return Math.min(1, weightedScore / 100);
  }

  // Calculate basic virality score for fallback
  calculateBasicViralityScore(metrics) {
    if (metrics.views === 0) return 0;

    const shareRate = metrics.shares / Math.max(1, metrics.views);
    const viralityIndicator = shareRate * 10;

    return Math.min(1, viralityIndicator);
  }

  // Calculate recency score with time decay
  calculateRecencyScore(createdAt) {
    const ageHours = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60);

    // Exponential decay: content loses 50% relevance every 24 hours
    return Math.exp(-ageHours / 24);
  }

  // Helper methods
  async getFriendsPosts(followingIds, baseQuery, limit) {
    return Post.find({
      ...baseQuery,
      author: { $in: followingIds },
      privacy: { $in: ["public", "friends"] },
    })
      .populate("author", "name username profilePicture isVerified")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name username profilePicture",
        },
        populate: {
          path: "replies",
        },
        options: { sort: { createdAt: -1 } },
      })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getPopularPosts(baseQuery, limit) {
    return Post.find({
      ...baseQuery,
      privacy: "public",
    })
      .populate("author", "name username profilePicture isVerified")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name username profilePicture",
        },
        populate: {
          path: "replies",
        },
        options: { sort: { createdAt: -1 } },
      })
      .sort({ reactionsCount: -1, commentsCount: -1 })
      .limit(limit);
  }

  async getLocalPosts(location, baseQuery, limit) {
    if (!location) return [];

    return Post.find({
      ...baseQuery,
      privacy: "public",
      "location.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
          $maxDistance: 50000, // 50km radius
        },
      },
    })
      .populate("author", "name username profilePicture isVerified")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name username profilePicture",
        },
        populate: {
          path: "replies",
        },
        options: { sort: { createdAt: -1 } },
      })
      .limit(limit);
  }

  async getTopicBasedPosts(topics, baseQuery, limit) {
    if (!topics || topics.length === 0) return [];

    const topicKeywords = topics
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((t) => t.keyword);

    return Post.find({
      ...baseQuery,
      privacy: "public",
      $text: { $search: topicKeywords.join(" ") },
    })
      .populate("author", "name username profilePicture isVerified")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name username profilePicture",
        },
        populate: {
          path: "replies",
        },
        options: { sort: { createdAt: -1 } },
      })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit);
  }

  async getTrendingPosts(baseQuery, limit) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return Post.find({
      ...baseQuery,
      privacy: "public",
      createdAt: { $gte: oneDayAgo },
    })
      .populate("author", "name username profilePicture isVerified")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name username profilePicture",
        },
        populate: {
          path: "replies",
        },
        options: { sort: { createdAt: -1 } },
      })
      .sort({
        reactionsCount: -1,
        commentsCount: -1,
        sharesCount: -1,
      })
      .limit(limit);
  }

  getPostType(post) {
    if (post.content.media && post.content.media.length > 0) {
      const mediaType = post.content.media[0].type;
      return mediaType === "image" ? "image" : "video";
    }
    return "text";
  }

  extractTopics(post) {
    // Simple keyword extraction - in production, use NLP libraries
    const text = post.content.text || "";
    const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];

    // Filter common words and return unique topics
    const stopWords = new Set([
      "the",
      "and",
      "for",
      "are",
      "but",
      "not",
      "you",
      "all",
      "can",
      "had",
      "her",
      "was",
      "one",
      "our",
      "out",
      "day",
      "get",
      "has",
      "him",
      "his",
      "how",
      "its",
      "may",
      "new",
      "now",
      "old",
      "see",
      "two",
      "who",
      "boy",
      "did",
      "she",
      "use",
      "way",
      "what",
      "when",
      "with",
    ]);

    return [
      ...new Set(
        words.filter((word) => !stopWords.has(word) && word.length > 3)
      ),
    ];
  }

  getInteractionWeight(interactionType) {
    const weights = {
      view: 0.1,
      like: 0.3,
      comment: 0.5,
      share: 0.7,
      save: 0.6,
      click: 0.4,
      follow: 0.8,
      hide: -0.5,
      report: -1.0,
    };
    return weights[interactionType] || 0.1;
  }

  calculateDistance(loc1, loc2) {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.latitude * Math.PI) / 180) *
        Math.cos((loc2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async initializeUserPreferences(userId) {
    const preferences = new UserPreference({
      user: userId,
      contentPreferences: {
        categories: [],
        postTypes: [
          { type: "text", score: 0 },
          { type: "image", score: 0 },
          { type: "video", score: 0 },
        ],
        topics: [],
      },
      timePreferences: {
        activeHours: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          activity: 0,
        })),
        activeDays: Array.from({ length: 7 }, (_, i) => ({
          day: i,
          activity: 0,
        })),
      },
    });

    return preferences.save();
  }

  async getFallbackFeed(userId, options) {
    // Simple chronological feed as fallback
    const { limit = 20, page = 1 } = options;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    const followingIds = user.following;

    const posts = await Post.find({
      $or: [
        {
          author: { $in: followingIds },
          privacy: { $in: ["public", "friends"] },
        },
        { privacy: "public" },
      ],
      isActive: true,
    })
      .populate("author", "name username profilePicture isVerified")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name username profilePicture",
        },
        populate: {
          path: "replies",
        },
        options: { sort: { createdAt: -1 } },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    return { posts, metadata: { fallback: true } };
  }
}

export default RecommendationEngine;
