import moment from 'moment';

const statusMessages = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

function handleResponse(code = 500, msg = '', data = null, res) {
  const defaultMessage = statusMessages[code] || 'An unknown error occurred.';
  const message = msg || defaultMessage;
  const success = code >= 200 && code < 300;

  res.status(code).json({
    http_status_code: code,
    http_status_msg: statusMessages[code] || 'Unknown Status',
    success,
    data,
    message,
    timestamp: moment().toISOString(),
  });
}

export default handleResponse;


