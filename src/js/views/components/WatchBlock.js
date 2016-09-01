const React = require('react');
const g = require('../../globals');
const ui = require('../../ui');
const league = require('../../core/league');

class WatchBlock extends React.Component {
    constructor(props) {
        super(props);

        // Keep in state so it can update instantly on click, rather than waiting for round trip
        this.state = {
            watch: props.watch,
        };

        this.handleClick = this.handleClick.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.watch !== this.state.watch) {
            this.setState({
                watch: nextProps.watch,
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        return this.props.pid !== nextProps.pid || this.state.watch !== nextState.watch;
    }

    async handleClick(e) {
        e.preventDefault();

        const watch = !this.state.watch;
        this.setState({
            watch,
        });

        await g.dbl.tx("players", "readwrite", async tx => {
            const p = await tx.players.get(this.props.pid);
            p.watch = watch;
            await tx.players.put(p);
        });

        league.updateLastDbChange();
        ui.realtimeUpdate(["watchList"]);
    }

    render() {
        // For Firefox's Object.watch
        if (typeof this.props.watch === 'function') {
            return null;
        }

        if (this.state.watch) {
            return <a className="glyphicon glyphicon-flag watch watch-active" onClick={this.handleClick} title="Remove from Watch List" data-no-davis="true" />;
        }

        return <a className="glyphicon glyphicon-flag watch" onClick={this.handleClick} title="Add to Watch List" data-no-davis="true" />;
    }
}

WatchBlock.propTypes = {
    pid: React.PropTypes.number.isRequired,
    watch: React.PropTypes.oneOfType([
        React.PropTypes.bool,
        React.PropTypes.func, // For Firefox's Object.watch
    ]).isRequired,
};

module.exports = WatchBlock;
