const facilityService = require('../services/facility.service');

async function getFacilities(req, res, next) {
  try {
    const facilities = await facilityService.getAllFacilities();
    res.json({
      success: true,
      data: facilities,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFacilities,
};
