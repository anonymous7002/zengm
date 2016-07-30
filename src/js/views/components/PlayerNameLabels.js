const React = require('react');
const helpers = require('../../util/helpers');
const SkillsBlock = require('./SkillsBlock');
const WatchBlock = require('./WatchBlock');

const PlayerNameLabels = ({pid, name, injury, skills, watch}) => {
    const playerName = <a href={helpers.leagueUrl(["player", pid])}>{name}</a>;

    let injuryIcon = null;
    if (injury !== undefined) {
        if (injury.gamesRemaining > 0) {
            const title = `${injury.type} (out ${injury.gamesRemaining} more games)`;
            injuryIcon = <span className="label label-danger label-injury" title={title}>{injury.gamesRemaining}</span>;
        } else if (injury.gamesRemaining === -1) {
            // This is used in box scores, where it would be confusing to display "out X more games" in old box scores
            injuryIcon = <span className="label label-danger label-injury" title={injury.type}>&nbsp;</span>;
        }
    }

    return <span>
        {playerName}
        {injuryIcon}
        <SkillsBlock skills={skills} />
        {watch !== undefined ? <WatchBlock pid={pid} watch={watch} /> : null}
    </span>;
};
PlayerNameLabels.propTypes = {
    pid: React.PropTypes.number.isRequired,
    name: React.PropTypes.string.isRequired,
    injury: React.PropTypes.shape({
        gamesRemaining: React.PropTypes.number.isRequired,
        type: React.PropTypes.string.isRequired,
    }),
    skills: React.PropTypes.arrayOf(React.PropTypes.string),
    watch: React.PropTypes.bool,
};

module.exports = PlayerNameLabels;
