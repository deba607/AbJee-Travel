import express from 'express';
import { body, query, validationResult } from 'express-validator';
import TravelPartnerRequest from '../models/TravelPartnerRequest.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/travel-partners/requests
// @desc    Get travel partner requests with filters
// @access  Private
router.get('/requests', authenticate, [
  query('destination').optional().isString(),
  query('country').optional().isString(),
  query('city').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('travelStyle').optional().isString(),
  query('interests').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      destination,
      country,
      city,
      startDate,
      endDate,
      travelStyle,
      interests,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    let query = {
      status: 'active',
      isPublic: true,
      expiresAt: { $gt: new Date() },
      startDate: { $gt: new Date() },
      requester: { $ne: req.user._id } // Exclude user's own requests
    };

    if (destination) {
      query.$or = [
        { 'destination.country': new RegExp(destination, 'i') },
        { 'destination.city': new RegExp(destination, 'i') },
        { 'destination.region': new RegExp(destination, 'i') }
      ];
    }

    if (country) {
      query['destination.country'] = new RegExp(country, 'i');
    }

    if (city) {
      query['destination.city'] = new RegExp(city, 'i');
    }

    if (startDate && endDate) {
      query.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (travelStyle) {
      query.travelStyle = travelStyle;
    }

    if (interests) {
      const interestArray = interests.split(',').map(i => i.trim());
      query.interests = { $in: interestArray };
    }

    const skip = (page - 1) * limit;

    const requests = await TravelPartnerRequest.find(query)
      .populate('requester', 'username firstName lastName avatar travelInterests')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TravelPartnerRequest.countDocuments(query);

    // Increment view count for each request
    const requestIds = requests.map(req => req._id);
    await TravelPartnerRequest.updateMany(
      { _id: { $in: requestIds } },
      { $inc: { views: 1 } }
    );

    res.json({
      success: true,
      data: {
        requests: requests.map(request => ({
          id: request._id,
          title: request.title,
          description: request.description,
          destination: request.destination,
          startDate: request.startDate,
          endDate: request.endDate,
          durationDays: request.durationDays,
          daysUntilTrip: request.daysUntilTrip,
          budget: request.budget,
          groupSize: request.groupSize,
          travelStyle: request.travelStyle,
          accommodation: request.accommodation,
          transportation: request.transportation,
          interests: request.interests,
          partnerRequirements: request.partnerRequirements,
          requester: request.requester,
          responseCount: request.responseCount,
          views: request.views,
          createdAt: request.createdAt,
          hasResponded: request.responses.some(
            response => response.user.toString() === req.user._id.toString()
          )
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get travel requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get travel partner requests'
    });
  }
});

// @route   POST /api/travel-partners/requests
// @desc    Create a new travel partner request
// @access  Private
router.post('/requests', authenticate, [
  body('title')
    .trim()
    .isLength({ min: 10, max: 100 })
    .withMessage('Title must be between 10 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 50, max: 1000 })
    .withMessage('Description must be between 50 and 1000 characters'),
  body('destination.country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('destination.city')
    .optional()
    .trim(),
  body('startDate')
    .isISO8601()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Start date must be in the future');
      }
      return true;
    }),
  body('endDate')
    .isISO8601()
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('travelStyle')
    .isIn(['budget', 'mid-range', 'luxury', 'backpacking', 'adventure', 'relaxed', 'cultural', 'party'])
    .withMessage('Invalid travel style'),
  body('groupSize.preferred')
    .isInt({ min: 1, max: 20 })
    .withMessage('Preferred group size must be between 1 and 20'),
  body('groupSize.maximum')
    .isInt({ min: 1, max: 20 })
    .withMessage('Maximum group size must be between 1 and 20'),
  body('interests')
    .isArray({ min: 1 })
    .withMessage('At least one interest is required'),
  body('budget.min')
    .optional()
    .isFloat({ min: 0 }),
  body('budget.max')
    .optional()
    .isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user has reached their request limit
    const activeRequestsCount = await TravelPartnerRequest.countDocuments({
      requester: req.user._id,
      status: 'active'
    });

    const maxRequests = req.user.subscription?.type === 'premium' ? -1 : 
                       req.user.subscription?.type === 'pro' ? 5 : 1;

    if (maxRequests !== -1 && activeRequestsCount >= maxRequests) {
      return res.status(403).json({
        success: false,
        message: `You have reached your limit of ${maxRequests} active travel partner request(s)`,
        upgradeRequired: true
      });
    }

    const requestData = {
      ...req.body,
      requester: req.user._id
    };

    const travelRequest = new TravelPartnerRequest(requestData);
    await travelRequest.save();

    await travelRequest.populate('requester', 'username firstName lastName avatar');

    res.status(201).json({
      success: true,
      message: 'Travel partner request created successfully',
      data: {
        request: {
          id: travelRequest._id,
          title: travelRequest.title,
          description: travelRequest.description,
          destination: travelRequest.destination,
          startDate: travelRequest.startDate,
          endDate: travelRequest.endDate,
          durationDays: travelRequest.durationDays,
          daysUntilTrip: travelRequest.daysUntilTrip,
          budget: travelRequest.budget,
          groupSize: travelRequest.groupSize,
          travelStyle: travelRequest.travelStyle,
          interests: travelRequest.interests,
          requester: travelRequest.requester,
          status: travelRequest.status,
          createdAt: travelRequest.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Create travel request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create travel partner request'
    });
  }
});

// @route   GET /api/travel-partners/requests/:requestId
// @desc    Get specific travel partner request
// @access  Private
router.get('/requests/:requestId', authenticate, async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await TravelPartnerRequest.findById(requestId)
      .populate('requester', 'username firstName lastName avatar bio travelInterests')
      .populate('responses.user', 'username firstName lastName avatar')
      .populate('matchedPartners', 'username firstName lastName avatar');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Travel partner request not found'
      });
    }

    // Increment view count
    await request.incrementViews();

    // Check if current user has responded
    const userResponse = request.responses.find(
      response => response.user._id.toString() === req.user._id.toString()
    );

    res.json({
      success: true,
      data: {
        request: {
          id: request._id,
          title: request.title,
          description: request.description,
          destination: request.destination,
          startDate: request.startDate,
          endDate: request.endDate,
          durationDays: request.durationDays,
          daysUntilTrip: request.daysUntilTrip,
          budget: request.budget,
          groupSize: request.groupSize,
          travelStyle: request.travelStyle,
          accommodation: request.accommodation,
          transportation: request.transportation,
          interests: request.interests,
          partnerRequirements: request.partnerRequirements,
          requester: request.requester,
          status: request.status,
          responses: request.responses,
          matchedPartners: request.matchedPartners,
          responseCount: request.responseCount,
          views: request.views,
          isPublic: request.isPublic,
          allowDirectContact: request.allowDirectContact,
          expiresAt: request.expiresAt,
          createdAt: request.createdAt,
          isOwner: request.requester._id.toString() === req.user._id.toString(),
          hasResponded: !!userResponse,
          userResponse: userResponse
        }
      }
    });

  } catch (error) {
    console.error('Get travel request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get travel partner request'
    });
  }
});

// @route   POST /api/travel-partners/requests/:requestId/respond
// @desc    Respond to a travel partner request
// @access  Private
router.post('/requests/:requestId/respond', authenticate, [
  body('message')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Response message must be between 10 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { requestId } = req.params;
    const { message } = req.body;

    const request = await TravelPartnerRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Travel partner request not found'
      });
    }

    if (request.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This request is no longer active'
      });
    }

    if (request.requester.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot respond to your own request'
      });
    }

    if (request.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'This request has expired'
      });
    }

    try {
      await request.addResponse(req.user._id, message);

      res.json({
        success: true,
        message: 'Response sent successfully',
        data: {
          responseId: request.responses[request.responses.length - 1]._id
        }
      });

    } catch (error) {
      if (error.message === 'User has already responded to this request') {
        return res.status(400).json({
          success: false,
          message: 'You have already responded to this request'
        });
      }
      throw error;
    }

  } catch (error) {
    console.error('Respond to travel request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send response'
    });
  }
});

// @route   GET /api/travel-partners/my-requests
// @desc    Get current user's travel partner requests
// @access  Private
router.get('/my-requests', authenticate, [
  query('status').optional().isIn(['active', 'matched', 'completed', 'cancelled', 'expired']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = { requester: req.user._id };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const requests = await TravelPartnerRequest.find(query)
      .populate('responses.user', 'username firstName lastName avatar')
      .populate('matchedPartners', 'username firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TravelPartnerRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests: requests.map(request => ({
          id: request._id,
          title: request.title,
          destination: request.destination,
          startDate: request.startDate,
          endDate: request.endDate,
          status: request.status,
          responseCount: request.responseCount,
          views: request.views,
          responses: request.responses,
          matchedPartners: request.matchedPartners,
          createdAt: request.createdAt,
          expiresAt: request.expiresAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get your travel requests'
    });
  }
});

export default router;
