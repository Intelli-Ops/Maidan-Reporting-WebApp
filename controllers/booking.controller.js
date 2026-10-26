const bookingService = require('../services/booking.service');

async function getSummary(req, res, next) {
  try {
    const { startDate, endDate, facilityId, sportTypeId } = req.query;

    const data = await bookingService.getBookingSummary({
      startDate,
      endDate,
      facilityId,
      sportTypeId,
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function getList(req, res, next) {
  try {
    const { startDate, endDate, facilityId, sportTypeId, limit, page } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const offset = (pageNum - 1) * limitNum;

    const data = await bookingService.getBookingsList({
      startDate,
      endDate,
      facilityId,
      sportTypeId,
      limit: limitNum,
      offset,
    });

    res.json({
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: data.total,
        totalPages: Math.ceil(data.total / limitNum),
      },
      data: data.bookings,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummary,
  getList,
};
