function sendSuccess(res, statusCode, message, data) {
  const body = { success: true };

  if (message) body.message = message;
  if (data !== undefined) body.data = data;

  return res.status(statusCode).json(body);
}

function sendList(res, data) {
  return res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
}

module.exports = { sendSuccess, sendList };
