import cron from 'node-cron';
import Story from '../models/Story.js';
import Notification from '../models/Notification.js';
import UserSession from '../models/UserSession.js';
import ContentScore from '../models/ContentScore.js';

class BackgroundJobManager {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Initialize all background jobs
  init() {
    if (this.isRunning) {
      console.log('Background jobs already running');
      return;
    }

    console.log('🔄 Initializing background jobs...');

    // Clean up expired stories every hour
    this.scheduleStoryCleanup();

    // Clean up old notifications every day
    this.scheduleNotificationCleanup();

    // Clean up old user sessions every 6 hours
    this.scheduleSessionCleanup();

    // Clean up expired content scores every day
    this.scheduleContentScoreCleanup();

    this.isRunning = true;
    console.log('✅ Background jobs initialized successfully');
  }

  // Schedule story cleanup job
  scheduleStoryCleanup() {
    const job = cron.schedule('0 * * * *', async () => { // Every hour
      try {
        console.log('🧹 Running story cleanup job...');
        
        // Find and delete expired stories
        const expiredStories = await Story.find({
          $or: [
            { expiresAt: { $lt: new Date() } },
            { isActive: false }
          ]
        });

        if (expiredStories.length > 0) {
          await Story.deleteMany({
            $or: [
              { expiresAt: { $lt: new Date() } },
              { isActive: false }
            ]
          });

          console.log(`🗑️  Deleted ${expiredStories.length} expired stories`);
        } else {
          console.log('✨ No expired stories to clean up');
        }
      } catch (error) {
        console.error('❌ Error in story cleanup job:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('storyCleanup', job);
    job.start();
    console.log('📅 Story cleanup job scheduled (every hour)');
  }

  // Schedule notification cleanup job
  scheduleNotificationCleanup() {
    const job = cron.schedule('0 2 * * *', async () => { // Every day at 2 AM
      try {
        console.log('🧹 Running notification cleanup job...');
        
        // Delete notifications older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const result = await Notification.deleteMany({
          createdAt: { $lt: thirtyDaysAgo },
          isActive: false
        });

        console.log(`🗑️  Deleted ${result.deletedCount} old notifications`);
      } catch (error) {
        console.error('❌ Error in notification cleanup job:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('notificationCleanup', job);
    job.start();
    console.log('📅 Notification cleanup job scheduled (daily at 2 AM)');
  }

  // Schedule user session cleanup job
  scheduleSessionCleanup() {
    const job = cron.schedule('0 */6 * * *', async () => { // Every 6 hours
      try {
        console.log('🧹 Running session cleanup job...');
        
        // Delete inactive sessions older than 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const result = await UserSession.deleteMany({
          $or: [
            { lastSeen: { $lt: sevenDaysAgo } },
            { isActive: false }
          ]
        });

        console.log(`🗑️  Deleted ${result.deletedCount} old user sessions`);
      } catch (error) {
        console.error('❌ Error in session cleanup job:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('sessionCleanup', job);
    job.start();
    console.log('📅 Session cleanup job scheduled (every 6 hours)');
  }

  // Schedule content score cleanup job
  scheduleContentScoreCleanup() {
    const job = cron.schedule('0 3 * * *', async () => { // Every day at 3 AM
      try {
        console.log('🧹 Running content score cleanup job...');
        
        // Delete content scores older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const result = await ContentScore.deleteMany({
          lastCalculated: { $lt: thirtyDaysAgo }
        });

        console.log(`🗑️  Deleted ${result.deletedCount} old content scores`);
      } catch (error) {
        console.error('❌ Error in content score cleanup job:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('contentScoreCleanup', job);
    job.start();
    console.log('📅 Content score cleanup job scheduled (daily at 3 AM)');
  }

  // Schedule immediate story deletion (for testing or manual cleanup)
  async deleteExpiredStoriesNow() {
    try {
      console.log('🧹 Running immediate story cleanup...');
      
      const expiredStories = await Story.find({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { isActive: false }
        ]
      });

      if (expiredStories.length > 0) {
        await Story.deleteMany({
          $or: [
            { expiresAt: { $lt: new Date() } },
            { isActive: false }
          ]
        });

        console.log(`🗑️  Immediately deleted ${expiredStories.length} expired stories`);
        return expiredStories.length;
      } else {
        console.log('✨ No expired stories to clean up');
        return 0;
      }
    } catch (error) {
      console.error('❌ Error in immediate story cleanup:', error);
      throw error;
    }
  }

  // Get job status
  getJobStatus() {
    const status = {};
    
    for (const [jobName, job] of this.jobs) {
      status[jobName] = {
        running: job.running,
        scheduled: job.scheduled
      };
    }

    return {
      isRunning: this.isRunning,
      jobs: status,
      totalJobs: this.jobs.size
    };
  }

  // Stop all jobs
  stopAllJobs() {
    console.log('🛑 Stopping all background jobs...');
    
    for (const [jobName, job] of this.jobs) {
      job.stop();
      console.log(`⏹️  Stopped ${jobName} job`);
    }

    this.isRunning = false;
    console.log('✅ All background jobs stopped');
  }

  // Restart all jobs
  restartAllJobs() {
    this.stopAllJobs();
    this.jobs.clear();
    this.init();
  }
}

// Create singleton instance
const backgroundJobManager = new BackgroundJobManager();

export default backgroundJobManager;