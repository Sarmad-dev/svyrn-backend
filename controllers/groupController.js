import mongoose from "mongoose";
import Group from "../models/Group.js";
import Post from "../models/Post.js";
import {
  getFileCategory,
  getMimeTypeFromBase64,
} from "../services/ImageUrlCreate.js";
import cloudinary from "../utils/cloudinary.js";
import NotificationHelper from "./../utils/notificationHelper.js";

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
export const createGroup = async (req, res) => {
  try {
    const { name, description, privacy, image } = req.body;

    const data = {
      name,
      description,
      privacy,
      creator: req.user.id,
      members: [
        {
          user: req.user.id,
          role: "admin",
          status: "active",
        },
      ],
    };

    if (image) {
      const mimeType = getMimeTypeFromBase64(image);
      const fileCategory = getFileCategory(mimeType);

      const result = await cloudinary.uploader.upload(image, {
        resource_type: fileCategory,
      });

      data.profilePicture = result.secure_url;
    }

    const group = await Group.create(data);

    await group.populate("creator", "name username profilePicture");

    res.status(201).json({
      status: "success",
      message: "Group created successfully",
      data: { group },
    });
  } catch (error) {
    console.error("ERROR: ", error);
    res.status(500).json({
      status: "error",
      message: "Error creating group",
      error: error.message,
    });
  }
};

// @desc    Get groups where user is a member
// @route   GET /api/groups/my-groups
// @access  Private
export const getUserGroups = async (req, res) => {
  try {
    const { limit = 10, cursor, role, status = "active" } = req.query;
    const limitNum = parseInt(limit);

    console.log('[DEBUG] getUserGroups called with:', { limit: limitNum, cursor, role, status });

    let query = {
      "members.user": req.user.id,
      "members.status": status,
      isActive: true,
    };

    // Filter by user's role in groups if specified
    if (role) {
      query["members.role"] = role;
    }

    // Add cursor condition if provided
    if (cursor) {
      query._id = { $lt: cursor };
      console.log('[DEBUG] Added cursor condition:', cursor);
    }

    // Fetch groups with limit + 1 to determine if there are more pages
    const groups = await Group.find(query)
      .populate("creator", "name username profilePicture")
      .populate("members.user", "name username profilePicture")
      .select(
        "name description coverPhoto profilePicture category privacy membersCount postsCount createdAt members"
      )
      .sort({ "members.joinedAt": -1, _id: -1 }) // Added _id for consistent cursor ordering
      .limit(limitNum + 1)
      .lean();

    console.log('[DEBUG] Fetched groups count:', groups.length);

    let hasNextPage = false;
    let nextCursor = null;

    // Determine if there are more pages and set nextCursor
    if (groups.length > limitNum) {
      hasNextPage = true;
      // Remove the extra group used for pagination
      const groupsToReturn = groups.slice(0, limitNum);
      // Set nextCursor to the _id of the last group in the current page
      nextCursor = groupsToReturn[groupsToReturn.length - 1]._id.toString();
      console.log('[DEBUG] Has next page, nextCursor:', nextCursor);
      
      // Add user's role and join date for each group
      const groupsWithUserInfo = groupsToReturn.map((group) => {
        // Only extract the current user's member object
        const userMember = group.members.find(
          (member) => member.user.toString() === req.user.id.toString()
        );

        return {
          _id: group._id,
          name: group.name,
          description: group.description,
          profilePicture: group.profilePicture,
          coverPhoto: group.coverPhoto,
          category: group.category,
          privacy: group.privacy,
          postsCount: group.posts?.length ?? 0,
          createdAt: group.createdAt,
          creator: group.creator,
          userRole: userMember?.role ?? null,
          memberStatus: userMember?.status ?? null,
          joinedAt: userMember?.joinedAt ?? null,
          lastVisit: userMember?.lastVisit ?? null,
        };
      });

      res.status(200).json({
        status: "success",
        data: {
          groups: groupsWithUserInfo,
          pagination: {
            hasNextPage,
            nextCursor,
            limit: limitNum,
            total: groupsToReturn.length,
          },
        },
      });
    } else {
      hasNextPage = false;
      console.log('[DEBUG] No next page, groups count:', groups.length);
      
      // Add user's role and join date for each group
      const groupsWithUserInfo = groups.map((group) => {
        // Only extract the current user's member object
        const userMember = group.members.find(
          (member) => member.user.toString() === req.user.id.toString()
        );

        return {
          _id: group._id,
          name: group.name,
          description: group.description,
          profilePicture: group.profilePicture,
          coverPhoto: group.coverPhoto,
          category: group.category,
          privacy: group.privacy,
          postsCount: group.posts?.length ?? 0,
          createdAt: group.createdAt,
          creator: group.creator,
          userRole: userMember?.role ?? null,
          memberStatus: userMember?.status ?? null,
          joinedAt: userMember?.joinedAt ?? null,
          lastVisit: userMember?.lastVisit ?? null,
        };
      });

      res.status(200).json({
        status: "success",
        data: {
          groups: groupsWithUserInfo,
          pagination: {
            hasNextPage,
            nextCursor,
            limit: limitNum,
            total: groups.length,
          },
        },
      });
    }
  } catch (error) {
    console.error('[DEBUG] Error in getUserGroups:', error);
    res.status(500).json({
      status: "error",
      message: "Error fetching user groups",
      error: error.message,
    });
  }
};

// @desc    Get groups (search/browse)
// @route   GET /api/groups
// @access  Private
export const getGroups = async (req, res) => {
  try {
    const { search, category, privacy, limit = 10, cursor } = req.query;
    const limitNum = parseInt(limit);

    console.log('[DEBUG] getGroups called with:', { search, category, privacy, limit: limitNum, cursor });

    let query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (privacy) {
      query.privacy = privacy;
    } else {
      // Don't show secret groups in general browse
      query.privacy = { $ne: "secret" };
    }

    // Add cursor condition if provided
    if (cursor) {
      query._id = { $lt: cursor };
      console.log('[DEBUG] Added cursor condition:', cursor);
    }

    // Build aggregation pipeline with cursor-based pagination
    const aggregationPipeline = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "creator",
        },
      },
      { $unwind: "$creator" },
      {
        $project: {
          name: 1,
          description: 1,
          profilePicture: 1,
          coverPhoto: 1,
          category: 1,
          privacy: 1,
          createdAt: 1,
          membersCount: {
            $size: {
              $filter: {
                input: "$members",
                as: "member",
                cond: { $eq: ["$$member.status", "active"] },
              },
            },
          },
          postsCount: { $size: "$posts" },
          isMember: {
            $in: [
              new mongoose.Types.ObjectId(req.user.id), // 👈 inject userId here
              {
                $map: {
                  input: "$members",
                  as: "m",
                  in: "$$m.user",
                },
              },
            ],
          },
          creator: {
            name: "$creator.name",
            username: "$creator.username",
            profilePicture: "$creator.profilePicture",
          },
        },
      },
      { $sort: { createdAt: -1, _id: -1 } }, // Added _id for consistent cursor ordering
      { $limit: limitNum + 1 }, // Fetch one extra to determine if there are more pages
    ];

    const groups = await Group.aggregate(aggregationPipeline);

    console.log('[DEBUG] Fetched groups count:', groups.length);

    let hasNextPage = false;
    let nextCursor = null;

    // Determine if there are more pages and set nextCursor
    if (groups.length > limitNum) {
      hasNextPage = true;
      // Remove the extra group used for pagination
      const groupsToReturn = groups.slice(0, limitNum);
      // Set nextCursor to the _id of the last group in the current page
      nextCursor = groupsToReturn[groupsToReturn.length - 1]._id.toString();
      console.log('[DEBUG] Has next page, nextCursor:', nextCursor);

      res.status(200).json({
        status: "success",
        data: {
          groups: groupsToReturn,
          pagination: {
            hasNextPage,
            nextCursor,
            limit: limitNum,
            total: groupsToReturn.length,
          },
        },
      });
    } else {
      hasNextPage = false;
      console.log('[DEBUG] No next page, groups count:', groups.length);

      res.status(200).json({
        status: "success",
        data: {
          groups,
          pagination: {
            hasNextPage,
            nextCursor,
            limit: limitNum,
            total: groups.length,
          },
        },
      });
    }
  } catch (error) {
    console.error('[DEBUG] Error in getGroups:', error);
    res.status(500).json({
      status: "error",
      message: "Error fetching groups",
      error: error.message,
    });
  }
};

// @desc    Get group details
// @route   GET /api/groups/:id
// @access  Private
export const getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("creator", "name username profilePicture")
      .populate("members.user", "name username profilePicture isVerified _id")
      .populate({
        path: "posts",
        select: "content author createdAt comments reactions",
        populate: [
          {
            path: "author",
            select: "name username profilePicture isVerified _id",
          },
          {
            path: "comments",
            populate: {
              path: "author",
              select: "name username profilePicture",
            },
          },
        ],
      });

    if (!group || !group.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Group not found",
      });
    }

    // Check if user is a member for private/secret groups
    const userMember = group.members.find(
      (member) => member.user._id.toString() === req.user.id.toString()
    );

    const isAdmin = userMember?.role === "admin";
    const isCreator =
      userMember?.user._id.toString() === group.creator._id.toString();
    const isModerator = userMember?.role === "moderator";

    if (group.privacy === "secret" && !userMember) {
      return res.status(403).json({
        status: "error",
        message: "Group not found",
      });
    }

    if (group.privacy === "private" && !userMember) {
      return res.status(403).json({
        status: "error",
        message: "This is a private group",
      });
    }

    // Update last visit for user
    if (userMember) {
      userMember.lastVisit = Date.now();
      await group.save();
    }

    const returnGroup = {
      ...group.toObject(),
      isAdmin,
      isCreator,
      isModerator,
    };

    console.log("Group to Return: ", returnGroup);

    res.status(200).json({
      status: "success",
      data: {
        group: returnGroup,
        userRole: userMember ? userMember.role : null,
        isMember: !!userMember,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Error fetching group",
      error: error.message,
    });
  }
};

// @desc    Join a group
// @route   POST /api/groups/:id/join
// @access  Private
export const joinGroup = async (req, res) => {
  try {
    const { message } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group || !group.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Group not found",
      });
    }

    // Check if already a member
    const existingMember = group.members.find(
      (member) => member.user.toString() === req.user.id.toString()
    );

    if (existingMember) {
      return res.status(400).json({
        status: "error",
        message: "You are already a member of this group",
      });
    }

    // Check if already has pending request
    const existingRequest = group.pendingRequests.find(
      (request) => request.user.toString() === req.user.id.toString()
    );

    if (existingRequest) {
      return res.status(400).json({
        status: "error",
        message: "You already have a pending request",
      });
    }

    if (group.privacy === "private" || group.settings.approveMembers) {
      // Add to pending requests
      group.pendingRequests.push({
        user: req.user.id,
        message: message || "",
        requestedAt: new Date(),
      });
      await group.save();

      res.status(200).json({
        status: "success",
        message: "Join request sent successfully",
      });
    } else {
      // Add directly as member
      group.members.push({
        user: req.user.id,
        role: "member",
        status: "active",
      });
      await group.save();

      for (const admin of admins) {
        // Send join notification to group creator
        await NotificationHelper.notifyJoinGroup(
          req.params.id,
          req.user.id,
          admin.user,
          group.name
        );
      }

      res.status(200).json({
        status: "success",
        message: "Joined group successfully",
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error joining group",
      error: error.message,
    });
  }
};

// @desc    Leave a group
// @route   DELETE /api/groups/:id/leave
// @access  Private
export const leaveGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group || !group.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Group not found",
      });
    }

    const memberIndex = group.members.findIndex(
      (member) => member.user.toString() === req.user.id.toString()
    );

    if (memberIndex === -1) {
      return res.status(400).json({
        status: "error",
        message: "You are not a member of this group",
      });
    }

    // Check if user is the creator
    if (group.creator.toString() === req.user.id.toString()) {
      return res.status(400).json({
        status: "error",
        message:
          "Group creator cannot leave. Transfer ownership or delete the group.",
      });
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    res.status(200).json({
      status: "success",
      message: "Left group successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error leaving group",
      error: error.message,
    });
  }
};

// @desc    Update group
// @route   PUT /api/groups/:id
// @access  Private
export const updateGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group || !group.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Group not found",
      });
    }

    // Check if user is admin
    const userMember = group.members.find(
      (member) => member.user.toString() === req.user.id.toString()
    );

    const isAdmin = userMember?.role === "admin";
    const isCreator =
      userMember?.user._id.toString() === group.creator._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({
        status: "error",
        message: "Only group admins can update group details",
      });
    }

    Object.assign(group, req.body);
    await group.save();

    await group.populate("creator", "firstName lastName profilePicture");

    res.status(200).json({
      status: "success",
      message: "Group updated successfully",
      data: { group },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error updating group",
      error: error.message,
    });
  }
};

// @desc    Get user group feed
// @route   GET /api/groups/my-groups/posts
// @access  Private
export const getUserGroupFeed = async (req, res) => {
  try {
    const { limit = 10, cursor } = req.query;
    const limitNum = parseInt(limit);

    console.log('[DEBUG] getUserGroupFeed called with:', { limit: limitNum, cursor });

    const userId = req.user.id;

    // Step 1: Find all group IDs where the user is a member
    const groups = await Group.find({
      "members.user": userId,
      "members.status": "active",
      isActive: true,
    }).select("_id");

    const groupIds = groups.map((group) => group._id);

    if (groupIds.length === 0) {
      return res.status(200).json({
        status: "success",
        data: {
          posts: [],
          pagination: {
            hasNextPage: false,
            nextCursor: null,
            limit: limitNum,
            total: 0,
          },
        },
      });
    }

    // Step 2: Build query with cursor-based pagination
    const baseQuery = {
      group: { $in: groupIds },
    };

    // Add cursor condition if provided
    if (cursor) {
      baseQuery._id = { $lt: cursor };
      console.log('[DEBUG] Added cursor condition:', cursor);
    }

    // Get posts with limit + 1 to determine if there are more pages
    const posts = await Post.find(baseQuery)
      .populate("author", "name username profilePicture")
      .populate("group", "name profilePicture privacy")
      .populate("tags", "name username profilePicture")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name username profilePicture",
        },
        options: { sort: { createdAt: -1 } },
      })
      .sort({ createdAt: -1, _id: -1 }) // Added _id for consistent cursor ordering
      .limit(limitNum + 1)
      .lean();

    console.log('[DEBUG] Fetched posts count:', posts.length);

    let hasNextPage = false;
    let nextCursor = null;

    // Determine if there are more pages and set nextCursor
    if (posts.length > limitNum) {
      hasNextPage = true;
      // Remove the extra post used for pagination
      const postsToReturn = posts.slice(0, limitNum);
      // Set nextCursor to the _id of the last post in the current page
      nextCursor = postsToReturn[postsToReturn.length - 1]._id.toString();
      console.log('[DEBUG] Has next page, nextCursor:', nextCursor);
      
      const formattedPosts = postsToReturn.map((post) => ({
        ...post,
        isGroup: post.group ? true : false,
      }));

      res.status(200).json({
        status: "success",
        data: {
          posts: formattedPosts,
          pagination: {
            hasNextPage,
            nextCursor,
            limit: limitNum,
            total: postsToReturn.length,
          },
        },
      });
    } else {
      hasNextPage = false;
      console.log('[DEBUG] No next page, posts count:', posts.length);
      
      const formattedPosts = posts.map((post) => ({
        ...post,
        isGroup: post.group ? true : false,
      }));

      res.status(200).json({
        status: "success",
        data: {
          posts: formattedPosts,
          pagination: {
            hasNextPage,
            nextCursor,
            limit: limitNum,
            total: posts.length,
          },
        },
      });
    }
  } catch (error) {
    console.error('[DEBUG] Error in getUserGroupFeed:', error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch group feed",
      error: error.message,
    });
  }
};
