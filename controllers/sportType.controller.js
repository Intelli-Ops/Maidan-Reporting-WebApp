const sportTypeService = require('../services/sportType.service');

async function getSportTypes(req, res, next) {
  try {
    const sportTypes = await sportTypeService.getAllSportTypes();
    res.json({
      success: true,
      data: sportTypes,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSportTypes,
};
