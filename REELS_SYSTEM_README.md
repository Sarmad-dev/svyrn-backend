# Reels Backend System

A comprehensive backend system for managing short-form video and image content (reels) with advanced features including privacy controls, analytics, moderation, and engagement tracking.

## 🏗️ System Architecture

The reels system follows the MVC (Model-View-Controller) pattern and includes:

- **Models**: Data structures for reels, comments, analytics, and reports
- **Controllers**: Business logic for all reel operations
- **Routes**: RESTful API endpoints
- **Middleware**: Authentication, validation, and error handling
- **Utilities**: Content analysis and helper functions

## 📊 Models

### 1. Reel Model (`models/Reel.js`)

The core model for storing reel content with comprehensive metadata.

**Key Features:**
- Media support (image/video) with metadata
- Privacy controls (public, friends, private, followers)
- Engagement tracking (likes, comments, shares, saves, views)
- Content categorization and tagging
- Monetization settings
- Trending algorithms
- Soft delete and archive functionality

**Schema Fields:**
```javascript
{
  author: ObjectId,           // User who created the reel
  media: {                    // Media information
    type: "image" | "video",
    url: String,
    thumbnail: String,
    duration: Number,
    size: Number,
    dimensions: { width, height }
  },
  caption: String,            // Reel description (max 2200 chars)
  audio: {                    // Audio information
    name: String,
    artist: String,
    isOriginal: Boolean,
    duration: Number
  },
  privacy: "public" | "friends" | "private" | "followers",
  location: {                 // Geographic information
    name: String,
    coordinates: { latitude, longitude }
  },
  tags: [ObjectId],           // Tagged users
  hashtags: [String],         // Extracted hashtags
  mentions: [ObjectId],       // Mentioned users
  category: String,           // Content category
  reactions: [{               // User reactions
    user: ObjectId,
    type: "like" | "love" | "haha" | "wow" | "sad" | "angry",
    createdAt: Date
  }],
  comments: [ObjectId],       // Comment references
  shares: [{                  // Share information
    user: ObjectId,
    sharedAt: Date,
    caption: String
  }],
  saves: [{                   // Save information
    user: ObjectId,
    savedAt: Date
  }],
  views: [{                   // View tracking
    user: ObjectId,
    viewedAt: Date,
    watchTime: Number,
    completionRate: Number
  }],
  trending: {                 // Trending metrics
    isTrending: Boolean,
    trendScore: Number,
    trendRank: Number,
    trendCategory: String
  }
}
```

### 2. ReelComment Model (`models/ReelComment.js`)

Handles comments on reels with support for replies and moderation.

**Key Features:**
- Nested comment structure (replies)
- Reaction system
- Moderation tools (hide, pin, spam detection)
- Edit history tracking
- Sentiment analysis

**Schema Fields:**
```javascript
{
  reel: ObjectId,             // Associated reel
  author: ObjectId,           // Comment author
  content: String,            // Comment text (max 1000 chars)
  parentComment: ObjectId,    // For replies
  replies: [ObjectId],        // Child comments
  reactions: [{               // Comment reactions
    user: ObjectId,
    type: String,
    createdAt: Date
  }],
  mentions: [ObjectId],       // Mentioned users
  hashtags: [String],         // Extracted hashtags
  isEdited: Boolean,          // Edit flag
  editHistory: [{             // Edit tracking
    content: String,
    editedAt: Date
  }],
  moderationStatus: "pending" | "approved" | "rejected" | "flagged",
  isHidden: Boolean,          // Hidden by moderator
  isPinned: Boolean,          // Pinned by reel author
  isSpam: Boolean,            // Spam detection
  spamScore: Number           // Spam probability (0-100)
}
```

### 3. ReelAnalytics Model (`models/ReelAnalytics.js`)

Comprehensive analytics and performance tracking for reels.

**Key Features:**
- View metrics (total, unique, by device, location, time)
- Engagement analytics (likes, comments, shares, saves)
- Watch time tracking and completion rates
- Audience demographics
- Performance metrics (reach, impressions, engagement rate)
- Trending analysis
- Revenue tracking (if monetized)
- Historical data

**Schema Fields:**
```javascript
{
  reel: ObjectId,             // Associated reel
  views: {                    // View metrics
    total: Number,
    unique: Number,
    byDevice: { mobile, desktop, tablet },
    byLocation: [{ country, region, city, count }],
    byTimeOfDay: [{ hour, count }],
    byDayOfWeek: [{ day, count }]
  },
  engagement: {                // Engagement metrics
    likes: { total, byType },
    comments: { total, replies, uniqueCommenters },
    shares: { total, internal, external },
    saves: { total, uniqueUsers },
    clicks: { total, profileClicks, linkClicks, hashtagClicks }
  },
  watchTime: {                 // Watch time analytics
    total: Number,
    average: Number,
    completionRates: [{ percentage, count }]
  },
  audience: {                  // Audience insights
    demographics: { ageGroups, genders, languages },
    interests: [{ category, count, percentage }],
    followers: { total, new, retained }
  },
  performance: {               // Performance metrics
    reach: { total, organic, paid, viral },
    impressions: { total, unique },
    engagementRate: { overall, byView, byReach },
    clickThroughRate: Number,
    retentionRate: Number
  },
  trending: {                  // Trending data
    isTrending: Boolean,
    trendScore: Number,
    trendRank: Number,
    peakViews: Number,
    peakEngagement: Number
  }
}
```

### 4. ReelReport Model (`models/ReelReport.js`)

Handles user reports and moderation workflow.

**Key Features:**
- Multiple report categories and severity levels
- Priority-based moderation queue
- Escalation system
- Evidence tracking
- Resolution tracking
- Satisfaction feedback

**Schema Fields:**
```javascript
{
  reel: ObjectId,             // Reported reel
  reporter: ObjectId,         // User who reported
  reason: String,             // Report reason
  details: String,            // Additional details
  category: String,           // Report category
  severity: "low" | "medium" | "high" | "critical",
  status: "pending" | "reviewing" | "resolved" | "dismissed",
  priority: Number,           // Calculated priority (0-10)
  isUrgent: Boolean,          // Urgency flag
  escalationLevel: Number,    // Escalation level (0-5)
  reviewDeadline: Date,       // Review deadline
  evidence: [{                // Supporting evidence
    type: String,
    url: String,
    description: String
  }],
  resolution: String,         // Resolution action
  timeToResolution: Number,   // Time to resolve (ms)
  satisfactionRating: Number  // User satisfaction (1-5)
}
```

## 🎮 Controllers

### 1. ReelController (`controllers/reelController.js`)

Handles all reel-related operations.

**Key Methods:**
- `createReel()` - Create new reel with validation
- `getReels()` - Get reels with filters and pagination
- `getTrendingReels()` - Get trending content
- `getUserFeed()` - Get personalized feed
- `getReelById()` - Get single reel with privacy checks
- `updateReel()` - Update reel with edit history
- `deleteReel()` - Soft delete reel
- `toggleReaction()` - Add/remove reactions
- `toggleSaveReel()` - Save/unsave reel
- `shareReel()` - Share reel with caption
- `getReelAnalytics()` - Get performance metrics
- `reportReel()` - Report inappropriate content

### 2. ReelCommentController (`controllers/reelCommentController.js`)

Manages comments and replies on reels.

**Key Methods:**
- `createComment()` - Create comment or reply
- `getReelComments()` - Get comments for a reel
- `getCommentReplies()` - Get replies for a comment
- `updateComment()` - Edit comment with history
- `deleteComment()` - Soft delete comment
- `toggleCommentReaction()` - React to comments
- `togglePinComment()` - Pin/unpin comments
- `toggleHideComment()` - Hide/unhide comments
- `flagCommentSpam()` - Flag spam comments
- `moderateComment()` - Moderate comment status

## 🛣️ API Routes

### Base Path: `/api/reels`

#### Reel Management
```
POST   /                    - Create new reel
GET    /                    - Get reels with filters
GET    /trending            - Get trending reels
GET    /feed                - Get user's feed
GET    /saved               - Get user's saved reels
GET    /user/:userId        - Get user's reels
GET    /:id                 - Get single reel
PUT    /:id                 - Update reel
DELETE /:id                 - Delete reel
PATCH  /:id/archive         - Archive/unarchive reel
```

#### Engagement
```
POST   /:id/reactions       - Toggle reaction
POST   /:id/save            - Toggle save
POST   /:id/share           - Share reel
```

#### Analytics
```
GET    /:id/analytics       - Get reel analytics
GET    /analytics/summary   - Get user analytics summary
```

#### Moderation
```
POST   /:id/report          - Report reel
```

#### Comments
```
POST   /:reelId/comments    - Create comment
GET    /:reelId/comments    - Get reel comments
GET    /comments/:commentId/replies - Get comment replies
PUT    /comments/:commentId - Update comment
DELETE /comments/:commentId - Delete comment
POST   /comments/:commentId/reactions - Toggle comment reaction
PATCH  /comments/:commentId/pin - Pin/unpin comment
PATCH  /comments/:commentId/hide - Hide/unhide comment
PATCH  /comments/:commentId/spam - Flag spam
PATCH  /comments/:commentId/moderate - Moderate comment
GET    /comments/user       - Get user's comments
GET    /comments/flagged    - Get flagged comments
```

## 🔐 Privacy & Security

### Privacy Levels
1. **Public** - Visible to everyone
2. **Friends** - Visible to friends only
3. **Followers** - Visible to followers only
4. **Private** - Visible to author only

### Access Control
- Privacy checks on all reel access
- User relationship validation
- Content ownership verification
- Moderation permissions

### Data Protection
- Soft delete for content preservation
- Edit history tracking
- Audit trails for moderation
- Rate limiting and abuse prevention

## 📈 Analytics & Insights

### Performance Metrics
- View counts and unique viewers
- Engagement rates and patterns
- Watch time and completion rates
- Audience demographics
- Geographic distribution
- Device and platform analytics

### Trending Algorithm
- Engagement velocity
- View growth rate
- Share amplification
- Category performance
- Time-based scoring

### Content Insights
- Best performing times
- Optimal hashtag combinations
- Audience retention patterns
- Content quality scoring

## 🚨 Moderation System

### Report Categories
- Spam and inappropriate content
- Violence and harassment
- Copyright violations
- Fake news and misinformation
- Hate speech
- Sexual content

### Moderation Workflow
1. **Report Submission** - User reports content
2. **Priority Assessment** - Automated scoring
3. **Review Queue** - Moderator assignment
4. **Action Taken** - Resolution and feedback
5. **Follow-up** - Monitoring and escalation

### Auto-Moderation
- Content analysis scoring
- Spam detection algorithms
- Duplicate report detection
- Priority calculation
- Escalation triggers

## 🛠️ Usage Examples

### Creating a Reel
```javascript
const reelData = {
  mediaType: "video",
  mediaUrl: "https://example.com/video.mp4",
  thumbnail: "https://example.com/thumbnail.jpg",
  caption: "Check out this amazing video! #awesome #viral",
  privacy: "public",
  category: "entertainment",
  duration: 15.5,
  size: 1024000,
  dimensions: { width: 1080, height: 1920 }
};

const response = await fetch('/api/reels', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(reelData)
});
```

### Getting Trending Reels
```javascript
const response = await fetch('/api/reels/trending?limit=20&category=entertainment', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const trendingReels = await response.json();
```

### Adding a Reaction
```javascript
const response = await fetch('/api/reels/64f1a2b3c4d5e6f7g8h9i0j/reactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ reactionType: 'love' })
});
```

### Creating a Comment
```javascript
const commentData = {
  content: "This is amazing! Great work! 👏",
  parentCommentId: null // null for top-level comment
};

const response = await fetch('/api/reels/64f1a2b3c4d5e6f7g8h9i0j/comments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(commentData)
});
```

### Getting Analytics
```javascript
const response = await fetch('/api/reels/64f1a2b3c4d5e6f7g8h9i0j/analytics', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const analytics = await response.json();
```

## 🔧 Configuration

### Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/social_network

# File Upload
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Content Moderation
AUTO_MODERATION_ENABLED=true
SPAM_THRESHOLD=70
REVIEW_DEADLINE_HOURS=24
```

### Database Indexes
The system automatically creates optimized indexes for:
- User queries and privacy filtering
- Trending and performance sorting
- Engagement metrics
- Moderation workflows
- Analytics aggregation

## 📊 Performance Considerations

### Database Optimization
- Compound indexes for common queries
- Aggregation pipelines for analytics
- Efficient pagination with skip/limit
- Background job processing

### Caching Strategy
- Redis caching for trending content
- CDN for media delivery
- In-memory caching for user sessions
- Query result caching

### Scalability Features
- Horizontal scaling support
- Load balancing ready
- Microservice architecture compatible
- Event-driven updates

## 🧪 Testing

### API Testing
```bash
# Test reel creation
curl -X POST http://localhost:5000/api/reels \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"mediaType":"image","mediaUrl":"https://example.com/image.jpg","caption":"Test reel"}'

# Test reel retrieval
curl -X GET http://localhost:5000/api/reels \
  -H "Authorization: Bearer ${TOKEN}"

# Test reactions
curl -X POST http://localhost:5000/api/reels/64f1a2b3c4d5e6f7g8h9i0j/reactions \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reactionType":"like"}'
```

### Unit Testing
```bash
npm test -- --grep "reels"
npm test -- --grep "comments"
npm test -- --grep "analytics"
```

## 🚀 Deployment

### Production Setup
1. **Environment Configuration**
   - Set production environment variables
   - Configure database connections
   - Set up monitoring and logging

2. **Security Measures**
   - Enable HTTPS
   - Configure CORS properly
   - Set up rate limiting
   - Enable content validation

3. **Performance Tuning**
   - Database connection pooling
   - Redis caching
   - CDN configuration
   - Load balancing

4. **Monitoring**
   - Application performance monitoring
   - Database query optimization
   - Error tracking and alerting
   - Usage analytics

## 🔮 Future Enhancements

### Planned Features
- **AI Content Analysis** - Automated content moderation
- **Advanced Analytics** - Machine learning insights
- **Live Streaming** - Real-time content creation
- **Collaborative Features** - Duets and reactions
- **Monetization Tools** - Creator economy features
- **Cross-Platform Sync** - Multi-platform content sharing

### Technical Improvements
- **GraphQL API** - Flexible data querying
- **Real-time Updates** - WebSocket enhancements
- **Microservices** - Service decomposition
- **Edge Computing** - Global content delivery
- **Blockchain Integration** - Content ownership verification

## 📚 Additional Resources

### Documentation
- [API Reference](./API_REFERENCE.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

### Code Examples
- [Frontend Integration](./FRONTEND_EXAMPLES.md)
- [Mobile SDK](./MOBILE_SDK.md)
- [Webhook Integration](./WEBHOOKS.md)

### Community
- [GitHub Issues](https://github.com/your-repo/issues)
- [Discord Community](https://discord.gg/your-community)
- [Developer Blog](https://blog.yourcompany.com)

---

**Built with ❤️ using Node.js, Express, and MongoDB**

For support and contributions, please refer to the project documentation and community guidelines.
