const expenseService = require('../services/expense.service');

async function getSummary(req, res, next) {
  try {
    const { startDate, endDate, facilityId, categoryId } = req.query;

    const data = await expenseService.getExpenseSummary({
      startDate,
      endDate,
      facilityId,
      categoryId,
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
    const { startDate, endDate, facilityId, categoryId, limit, page } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const offset = (pageNum - 1) * limitNum;

    const data = await expenseService.getExpensesList({
      startDate,
      endDate,
      facilityId,
      categoryId,
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
      data: data.expenses,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummary,
  getList,
};
