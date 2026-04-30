import { memo } from 'react';

const PollCard = ({
  field,
  selectedOption,
  submitting,
  onVote,
  currentIndex,
  totalFields,
  onPrevious,
  onNext
}) => {
  const hasVoted = Boolean(selectedOption);
  const isFirstField = currentIndex === 0;
  const isLastField = currentIndex === totalFields - 1;

  return (
    <article className="poll-card">
      <div className="poll-card-header">
        <div>
          <p className="eyebrow">Award Category</p>
          <h3>{field.title}</h3>
        </div>
      </div>

      <div className="poll-progress">
        <strong>
          Category {currentIndex + 1} of {totalFields}
        </strong>
        <span>{hasVoted ? 'Vote recorded for this category.' : 'Select one nominee to cast your vote.'}</span>
      </div>

      <div className="option-grid">
        {field.options.map((option) => {
          const isSelected = selectedOption === option;

          return (
            <button
              key={option}
              className={`option-button ${isSelected ? 'selected' : ''}`}
              disabled={hasVoted || submitting}
              onClick={() => onVote(field.id, option)}
              type="button"
            >
              <span>{option}</span>
              {isSelected ? <strong>Your vote</strong> : null}
            </button>
          );
        })}
      </div>

      <div className="poll-navigation">
        <button className="ghost-button" disabled={isFirstField} onClick={onPrevious} type="button">
          Previous
        </button>
        <button className="primary-button" disabled={isLastField} onClick={onNext} type="button">
          Next
        </button>
      </div>
    </article>
  );
};

export default memo(PollCard, (previousProps, nextProps) => {
  return (
    previousProps.field === nextProps.field &&
    previousProps.selectedOption === nextProps.selectedOption &&
    previousProps.submitting === nextProps.submitting &&
    previousProps.onVote === nextProps.onVote &&
    previousProps.currentIndex === nextProps.currentIndex &&
    previousProps.totalFields === nextProps.totalFields &&
    previousProps.onPrevious === nextProps.onPrevious &&
    previousProps.onNext === nextProps.onNext
  );
});
