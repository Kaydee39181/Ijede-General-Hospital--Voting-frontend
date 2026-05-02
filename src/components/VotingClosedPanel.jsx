import { formatVotingCloseAt } from '../utils/votingWindow';

const VotingClosedPanel = ({ closesAt }) => (
  <section className="page-grid submission-page">
    <div className="panel submission-panel">
      <img
        alt="General Hospital Ijede logo"
        className="submission-logo"
        src="/branding/ijede_general_hospital_logo.png"
      />
      <p className="eyebrow">Voting Closed</p>
      <h2>The voting period has ended.</h2>
      <p className="muted-text">
        Voting for the General Hospital Ijede Staff Awards is now closed and no more ballots can be
        submitted.
      </p>
      <p className="notice-text">
        Voting closed at {formatVotingCloseAt(closesAt)} Nigerian time.
      </p>
    </div>
  </section>
);

export default VotingClosedPanel;
