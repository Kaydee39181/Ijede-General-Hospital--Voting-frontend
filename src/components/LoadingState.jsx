const LoadingState = ({ message = 'Loading...' }) => (
  <div className="panel center-panel">
    <div className="loader" />
    <p>{message}</p>
  </div>
);

export default LoadingState;
