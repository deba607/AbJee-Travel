import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ChatRoom from '../models/ChatRoom.js';
import User from '../models/User.js';
import TravelPartnerRequest from '../models/TravelPartnerRequest.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abjee-travel');
    console.log('📦 MongoDB Connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

const createDemoRooms = async () => {
  try {
    // Create a demo admin user
    let adminUser = await User.findOne({ email: 'admin@abjee.com' });
    
    if (!adminUser) {
      adminUser = new User({
        firstName: 'Admin',
        lastName: 'User',
        username: 'admin',
        email: 'admin@abjee.com',
        password: 'Admin123!',
        address: '123 Admin St',
        city: 'Admin City',
        zipCode: '12345',
        subscription: {
          type: 'premium',
          isActive: true
        }
      });
      await adminUser.save();
      console.log('✅ Created admin user');
    }

    // Demo public rooms
    const publicRooms = [
      {
        name: 'General Travel Chat',
        description: 'General discussion about travel experiences, tips, and advice',
        type: 'public',
        destination: { country: 'Global', region: 'Worldwide' },
        tags: ['general', 'travel', 'tips'],
        createdBy: adminUser._id
      },
      {
        name: 'Europe Backpackers',
        description: 'Connect with fellow backpackers exploring Europe',
        type: 'public',
        destination: { country: 'Europe', region: 'Multiple Countries' },
        tags: ['europe', 'backpacking', 'budget'],
        createdBy: adminUser._id
      },
      {
        name: 'Southeast Asia Adventures',
        description: 'Share experiences and tips for traveling in Southeast Asia',
        type: 'public',
        destination: { country: 'Thailand', city: 'Bangkok', region: 'Southeast Asia' },
        tags: ['asia', 'adventure', 'culture'],
        createdBy: adminUser._id
      },
      {
        name: 'Japan Travel Guide',
        description: 'Everything about traveling in Japan - culture, food, places',
        type: 'public',
        destination: { country: 'Japan', city: 'Tokyo' },
        tags: ['japan', 'culture', 'food'],
        createdBy: adminUser._id
      },
      {
        name: 'Solo Female Travelers',
        description: 'Safe space for solo female travelers to share experiences',
        type: 'public',
        destination: { country: 'Global', region: 'Worldwide' },
        tags: ['solo', 'female', 'safety'],
        createdBy: adminUser._id
      },
      {
        name: 'Digital Nomads Hub',
        description: 'For remote workers and digital nomads sharing travel tips',
        type: 'public',
        destination: { country: 'Global', region: 'Worldwide' },
        tags: ['nomad', 'remote-work', 'wifi'],
        createdBy: adminUser._id
      }
    ];

    // Private rooms (for demo)
    const privateRooms = [
      {
        name: 'VIP Travel Lounge',
        description: 'Exclusive chat for premium travelers',
        type: 'private',
        subscriptionRequired: true,
        destination: { country: 'Global', region: 'Worldwide' },
        tags: ['vip', 'luxury', 'premium'],
        createdBy: adminUser._id,
        maxMembers: 50
      },
      {
        name: 'Luxury Resort Reviews',
        description: 'Private discussions about high-end accommodations',
        type: 'private',
        subscriptionRequired: true,
        destination: { country: 'Global', region: 'Worldwide' },
        tags: ['luxury', 'resorts', 'reviews'],
        createdBy: adminUser._id,
        maxMembers: 30
      }
    ];

    // Travel partner rooms
    const travelPartnerRooms = [
      {
        name: 'Find Travel Buddies',
        description: 'Connect with potential travel companions',
        type: 'travel_partner',
        destination: { country: 'Global', region: 'Worldwide' },
        tags: ['partners', 'buddies', 'companions'],
        createdBy: adminUser._id
      }
    ];

    const allRooms = [...publicRooms, ...privateRooms, ...travelPartnerRooms];

    for (const roomData of allRooms) {
      const existingRoom = await ChatRoom.findOne({ name: roomData.name });
      
      if (!existingRoom) {
        const room = new ChatRoom(roomData);
        
        // Add admin as a member
        room.members.push({
          user: adminUser._id,
          role: 'admin',
          joinedAt: new Date(),
          lastReadAt: new Date()
        });
        
        await room.save();
        console.log(`✅ Created room: ${room.name}`);
      } else {
        console.log(`⏭️  Room already exists: ${roomData.name}`);
      }
    }

    console.log('🎉 Demo rooms setup completed!');

  } catch (error) {
    console.error('❌ Error creating demo rooms:', error);
  }
};

const createDemoTravelRequests = async () => {
  try {
    const adminUser = await User.findOne({ email: 'admin@abjee.com' });
    if (!adminUser) return;

    const demoRequests = [
      {
        requester: adminUser._id,
        title: 'Looking for travel buddy to explore Japan',
        description: 'Planning a 2-week trip to Japan in spring 2024. Looking for someone to share the experience, split costs, and explore together. Interested in culture, food, and traditional sites.',
        destination: {
          country: 'Japan',
          city: 'Tokyo'
        },
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        endDate: new Date(Date.now() + 44 * 24 * 60 * 60 * 1000), // 44 days from now
        budget: {
          min: 2000,
          max: 3500,
          currency: 'USD'
        },
        groupSize: {
          preferred: 2,
          maximum: 3
        },
        travelStyle: 'cultural',
        accommodation: ['hotel', 'guesthouse'],
        transportation: ['flight', 'train'],
        interests: ['culture', 'food', 'history', 'photography'],
        partnerRequirements: {
          ageRange: { min: 25, max: 40 },
          gender: 'any',
          experience: 'intermediate'
        }
      },
      {
        requester: adminUser._id,
        title: 'Backpacking through Southeast Asia',
        description: 'Planning a 3-month backpacking adventure through Thailand, Vietnam, Cambodia, and Laos. Looking for adventurous travel companions who love street food and off-the-beaten-path experiences.',
        destination: {
          country: 'Thailand',
          city: 'Bangkok'
        },
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000), // 150 days from now
        budget: {
          min: 1500,
          max: 2500,
          currency: 'USD'
        },
        groupSize: {
          preferred: 3,
          maximum: 4
        },
        travelStyle: 'backpacking',
        accommodation: ['hostel', 'guesthouse'],
        transportation: ['bus', 'train', 'local_transport'],
        interests: ['adventure', 'food', 'culture', 'nature'],
        partnerRequirements: {
          ageRange: { min: 20, max: 35 },
          gender: 'any',
          experience: 'any'
        }
      }
    ];

    for (const requestData of demoRequests) {
      const existingRequest = await TravelPartnerRequest.findOne({ 
        title: requestData.title 
      });
      
      if (!existingRequest) {
        const request = new TravelPartnerRequest(requestData);
        await request.save();
        console.log(`✅ Created travel request: ${request.title}`);
      } else {
        console.log(`⏭️  Travel request already exists: ${requestData.title}`);
      }
    }

    console.log('🎉 Demo travel requests setup completed!');

  } catch (error) {
    console.error('❌ Error creating demo travel requests:', error);
  }
};

const setupDemo = async () => {
  console.log('🚀 Setting up ABjee Travel demo data...');
  
  await connectDB();
  await createDemoRooms();
  await createDemoTravelRequests();
  
  console.log('✨ Demo setup completed successfully!');
  process.exit(0);
};

// Run the setup
setupDemo().catch((error) => {
  console.error('❌ Demo setup failed:', error);
  process.exit(1);
});
