const ErrorState = ({ message, onRetry }) => (
  <div className="panel center-panel">
    <p className="error-text">{message}</p>
    {onRetry ? (
      <button className="primary-button" onClick={onRetry} type="button">
        Try again
      </button>
    ) : null}
  </div>
);

export default ErrorState;
