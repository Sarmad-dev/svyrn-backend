import User from "./../models/User.js";
import Group from "./../models/Group.js";
import Page from "./../models/Page.js";
import Ad from "./../models/Ad.js";
import Product from "./../models/Product.js";
import SearchAnalytics from "./../models/SearchAnalytics.js";

// @desc    Global search across all content types
// @route   GET /api/search/global
// @access  Private
export const globalSearch = async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      query,
      filters = ["users", "groups", "pages", "ads", "products"],
      limit = 10,
      offset = 0,
    } = req.query;

    // Validate required query parameter
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        status: "error",
        message: "Search query must be at least 2 characters long",
      });
    }

    // Validate filters
    const validFilters = ["users", "groups", "pages", "ads", "products"];
    const searchFilters = Array.isArray(filters) ? filters : [filters];
    const invalidFilters = searchFilters.filter?.(
      (f) => !validFilters.includes(f)
    );

    if (invalidFilters && invalidFilters.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Invalid filters: ${invalidFilters.join(", ")}`,
      });
    }

    const searchTerm = query.trim();
    const searchRegex = new RegExp(searchTerm.split(" ").join("|"), "i");
    const limitNum = Math.min(parseInt(limit) || 10, 50); // Max 50 results per category
    const offsetNum = parseInt(offset) || 0;

    const results = {
      users: [],
      groups: [],
      pages: [],
      ads: [],
      products: [],
    };

    let totalCount = 0;

    // Search Users
    if (searchFilters?.includes("users")) {
      const users = await User.find({
        $and: [
          {
            $or: [
              { name: searchRegex },
              { email: searchRegex },
              { bio: searchRegex },
            ],
          },
          { isActive: true },
          { "privacy.profileVisibility": { $in: ["public", "friends"] } },
        ],
      })
        .select("name username profilePicture bio isVerified followersCount")
        .sort({ isVerified: -1, followersCount: -1 })
        .limit(limitNum)
        .skip(offsetNum);

      results.users = users.map((user) => ({
        ...user.toObject(),
        relevanceScore: calculateUserRelevance(user, searchTerm),
        type: "user",
      }));

      totalCount += users.length || 0;
    }

    // Search Groups
    if (searchFilters?.includes("groups")) {
      const groups = await Group.find({
        $and: [
          {
            $or: [{ name: searchRegex }, { description: searchRegex }],
          },
          { isActive: true },
          { privacy: { $ne: "secret" } },
        ],
      })
        .populate("creator", "name username profilePicture")
        .select("name description profilePicture category privacy membersCount")
        .sort({ membersCount: -1 })
        .limit(limitNum)
        .skip(offsetNum);

      results.groups = groups.map((group) => ({
        ...group.toObject(),
        relevanceScore: calculateGroupRelevance(group, searchTerm),
        type: "group",
      }));

      totalCount += groups.length || 0;
    }

    // Search Pages
    if (searchFilters.includes("pages")) {
      const pages = await Page.find({
        $and: [
          {
            $or: [{ name: searchRegex }, { description: searchRegex }],
          },
          { isActive: true },
        ],
      })
        .populate("owner", "name username profilePicture")
        .select(
          "name description profilePicture category followersCount isVerified"
        )
        .sort({ isVerified: -1, followersCount: -1 })
        .limit(limitNum)
        .skip(offsetNum);

      results.pages = pages.map((page) => ({
        ...page.toObject(),
        relevanceScore: calculatePageRelevance(page, searchTerm),
        type: "page",
      }));

      totalCount += pages.length || 0;
    }

    // Search Ads (only active ads)
    if (searchFilters.includes("ads")) {
      const ads = await Ad.find({
        $and: [
          {
            $or: [{ title: searchRegex }, { description: searchRegex }],
          },
          { status: "active" },
          { isActive: true },
          { "schedule.startDate": { $lte: new Date() } },
          {
            $or: [
              { "schedule.endDate": { $exists: false } },
              { "schedule.endDate": { $gte: new Date() } },
            ],
          },
        ],
      })
        .populate("advertiser", "name username profilePicture")
        .select("title description creative budget performance")
        .sort({ "performance.impressions": -1 })
        .limit(limitNum)
        .skip(offsetNum);

      results.ads = ads.map((ad) => ({
        ...ad.toObject(),
        relevanceScore: calculateAdRelevance(ad, searchTerm),
        type: "ad",
      }));

      totalCount += ads.length || 0;
    }

    // Search Products
    if (searchFilters.includes("products")) {
      const products = await Product.find({
        $and: [
          {
            $or: [
              { title: searchRegex },
              { description: searchRegex },
              { tags: { $in: [searchRegex] } },
            ],
          },
          { "availability.status": "available" },
          { isActive: true },
        ],
      })
        .populate("seller", "name username profilePicture")
        .select(
          "title description price images category condition location views"
        )
        .sort({ views: -1, createdAt: -1 })
        .limit(limitNum)
        .skip(offsetNum);

      results.products = products.map((product) => ({
        ...product.toObject(),
        relevanceScore: calculateProductRelevance(product, searchTerm),
        type: "product",
      }));

      totalCount += products.length || 0;
    }

    // Sort all results by relevance score
    Object.keys(results).forEach((key) => {
      results[key].sort((a, b) => b.relevanceScore - a.relevanceScore);
    });

    const executionTime = Date.now() - startTime;

    // Log search analytics
    await logSearchAnalytics({
      userId: req.user.id,
      query: searchTerm,
      filters: searchFilters,
      resultsCount: totalCount,
      executionTime,
      timestamp: new Date(),
    });

    res.status(200).json({
      status: "success",
      query: searchTerm,
      results,
      total_count: totalCount,
      execution_time: `${executionTime}ms`,
      filters_applied: searchFilters,
    });
  } catch (error) {
    console.log("Search Error: ", error);
    const executionTime = Date.now() - startTime;

    res.status(500).json({
      status: "error",
      message: "Search failed",
      error: error.message,
      execution_time: `${executionTime}ms`,
    });
  }
};

// Relevance calculation functions
const calculateUserRelevance = (user, searchTerm) => {
  let score = 0;
  const term = searchTerm.toLowerCase();

  // Exact name match gets highest score
  const fullName = `${user.name}`.toLowerCase();
  if (fullName.includes(term)) score += 10;

  // Bio match
  if (user.bio && user.bio.toLowerCase().includes(term)) score += 5;

  // Verified users get bonus
  if (user.isVerified) score += 3;

  // Popular users get bonus
  score += Math.min(user.followersCount / 1000, 5);

  return score;
};

const calculateGroupRelevance = (group, searchTerm) => {
  let score = 0;
  const term = searchTerm.toLowerCase();

  // Exact name match
  if (group.name.toLowerCase().includes(term)) score += 10;

  // Description match
  if (group.description && group.description.toLowerCase().includes(term))
    score += 6;

  // Category match
  if (group.category.toLowerCase().includes(term)) score += 4;

  // Member count bonus
  score += Math.min(group.membersCount / 100, 5);

  // Public groups get slight bonus
  if (group.privacy === "public") score += 2;

  return score;
};

const calculatePageRelevance = (page, searchTerm) => {
  let score = 0;
  const term = searchTerm.toLowerCase();

  // Exact name match
  if (page.name.toLowerCase().includes(term)) score += 10;

  // Description match
  if (page.description && page.description.toLowerCase().includes(term))
    score += 6;

  // Category match
  if (page.category.toLowerCase().includes(term)) score += 4;

  // Verified pages get bonus
  if (page.isVerified) score += 5;

  // Follower count bonus
  score += Math.min(page.followersCount / 1000, 5);

  return score;
};

const calculateAdRelevance = (ad, searchTerm) => {
  let score = 0;
  const term = searchTerm.toLowerCase();

  // Title match
  if (ad.title.toLowerCase().includes(term)) score += 10;

  // Description match
  if (ad.description.toLowerCase().includes(term)) score += 7;

  // Performance bonus (CTR)
  if (ad.performance.ctr > 0.02) score += 3; // Good CTR

  // Recent ads get bonus
  const daysSinceCreated = (Date.now() - ad.createdAt) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated < 7) score += 2;

  return score;
};

const calculateProductRelevance = (product, searchTerm) => {
  let score = 0;
  const term = searchTerm.toLowerCase();

  // Title match
  if (product.title.toLowerCase().includes(term)) score += 10;

  // Description match
  if (product.description.toLowerCase().includes(term)) score += 6;

  // Tags match
  if (
    product.tags &&
    product.tags.some((tag) => tag.toLowerCase().includes(term))
  ) {
    score += 8;
  }

  // Category match
  if (product.category.toLowerCase().includes(term)) score += 4;

  // View count bonus
  score += Math.min(product.views / 100, 3);

  // New condition gets bonus
  if (product.condition === "new") score += 1;

  return score;
};

// Log search analytics
const logSearchAnalytics = async (analyticsData) => {
  try {
    await SearchAnalytics.create(analyticsData);
  } catch (error) {
    console.error("Failed to log search analytics:", error);
  }
};
