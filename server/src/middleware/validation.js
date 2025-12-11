const Joi = require('joi');

const roomSchema = Joi.object({
  name: Joi.string().required().trim().max(50),
  description: Joi.string().trim().max(200).allow(''),
  type: Joi.string().valid('public', 'private', 'travel_partner').required(),
  destination: Joi.object({
    country: Joi.string().required(),
    city: Joi.string().allow(''),
    region: Joi.string().allow('')
  })
});

const validateRoom = (req, res, next) => {
  const { error } = roomSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }
  next();
};

module.exports = {
  validateRoom
};