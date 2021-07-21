import { season } from "..";
import { idb } from "../../db";
import { g, local, logEvent } from "../../util";
import type { Conditions, PhaseReturn } from "../../../common/types";
import {
	EMAIL_ADDRESS,
	FACEBOOK_USERNAME,
	GAME_NAME,
	isSport,
	SUBREDDIT_NAME,
	TWITTER_HANDLE,
} from "../../../common";
import { unwrap } from "idb";

const newPhaseRegularSeason = async (
	conditions: Conditions,
): Promise<PhaseReturn> => {
	const teams = await idb.getCopies.teamsPlus({
		attrs: ["tid"],
		seasonAttrs: ["cid", "did"],
		season: g.get("season"),
		active: true,
	});

	await season.setSchedule(season.newSchedule(teams, conditions));

	if (g.get("autoDeleteOldBoxScores")) {
		// openKeyCursor rather than iterate for performance in Firefox.
		// unwrap for old Firefox support
		await new Promise<void>((resolve, reject) => {
			const transaction = unwrap(idb.league.transaction("games", "readwrite"));
			const store = transaction.objectStore("games");
			const index = store.index("season");

			const request = index.openKeyCursor(
				IDBKeyRange.upperBound(g.get("season") - 3),
			);
			request.onsuccess = () => {
				const cursor = request.result;
				if (cursor) {
					store.delete(cursor.primaryKey);
					cursor.continue();
				} else {
					resolve();
				}
			};

			const onerror = () => {
				reject(transaction.error ?? new Error("Transaction error"));
			};
			transaction.onerror = onerror;
			transaction.onabort = onerror;
		});
	}

	// Without this, then there is a race condition creating it on demand in addGame, and some of the first day's games are lost
	await idb.cache.headToHeads.put({
		season: g.get("season"),
		regularSeason: {},
		playoffs: {},
	});

	if (!local.autoPlayUntil) {
		let naggedMailingList = await idb.meta.get(
			"attributes",
			"naggedMailingList",
		);
		if (typeof naggedMailingList !== "number") {
			naggedMailingList = 0;
		}
		if (
			!local.mailingList &&
			g.get("season") === g.get("startingSeason") + 3 &&
			g.get("lid") > 3 &&
			(naggedMailingList === 0 ||
				(naggedMailingList === 1 && Math.random() < 0.01))
		) {
			await idb.meta.put(
				"attributes",
				naggedMailingList + 1,
				"naggedMailingList",
			);
			logEvent({
				extraClass: "",
				persistent: true,
				saveToDb: false,
				text: `<b>Mailing List</b><br>If you'd like to receive a quarterly email containing the latest news about ${GAME_NAME}, <a href="https://landing.mailerlite.com/webforms/landing/z7d2z9" target="_blank" rel="noopener noreferrer">subscribe to our newsletter here</a>.`,
				type: "info",
			});
		} else {
			const nagged = await idb.meta.get("attributes", "nagged");

			if (
				g.get("season") === g.get("startingSeason") + 3 &&
				g.get("lid") > 3 &&
				(nagged === 0 || nagged === undefined)
			) {
				await idb.meta.put("attributes", 1, "nagged");
				await idb.cache.messages.add({
					read: false,
					from: "The Commissioner",
					year: g.get("season"),
					text: `<p>Hi. Sorry to bother you, but I noticed that you've been playing this game a bit. Hopefully that means you like it. Either way, I would really appreciate some feedback to help me make it better. <a href="mailto:${EMAIL_ADDRESS}">Send an email</a> (${EMAIL_ADDRESS}) or join the discussion on <a href="http://www.reddit.com/r/${SUBREDDIT_NAME}/">Reddit</a> or <a href="https://discord.gg/caPFuM9">Discord</a>.</p>`,
				});
			} else if (nagged !== undefined) {
				if (
					(nagged === 1 && Math.random() < 0.125) ||
					(nagged >= 2 && Math.random() < 0.0125)
				) {
					await idb.meta.put("attributes", 2, "nagged");
					await idb.cache.messages.add({
						read: false,
						from: "The Commissioner",
						year: g.get("season"),
						text: `<p>Hi. Sorry to bother you again, but if you like the game, please share it with your friends! Also:</p><p><a href="https://twitter.com/${TWITTER_HANDLE}">Follow ${GAME_NAME} on Twitter</a></p><p><a href="https://www.facebook.com/${FACEBOOK_USERNAME}">Like ${GAME_NAME} on Facebook</a></p><p><a href="http://www.reddit.com/r/${SUBREDDIT_NAME}/">Discuss ${GAME_NAME} on Reddit</a></p><p><a href="https://discord.gg/caPFuM9">Chat with ${GAME_NAME} players and devs on Discord</a></p><p>The more people that play ${GAME_NAME}, the more motivation I have to continue improving it. So it is in your best interest to help me promote the game! If you have any other ideas, please <a href="mailto:${EMAIL_ADDRESS}">email me</a>.</p>`,
					});
				} else if (
					isSport("basketball") &&
					nagged >= 2 &&
					nagged <= 3 &&
					Math.random() < 0.5
				) {
					// Skipping 3, obsolete
					await idb.meta.put("attributes", 4, "nagged");
					await idb.cache.messages.add({
						read: false,
						from: "The Commissioner",
						year: g.get("season"),
						text: '<p>Want to try multiplayer Basketball GM? Some intrepid souls have banded together to form online multiplayer leagues, and <a href="https://www.reddit.com/r/BasketballGM/wiki/basketball_gm_multiplayer_league_list">you can find a user-made list of them here</a>.</p>',
					});
				}
			}
		}
	}

	if (
		navigator.storage &&
		navigator.storage.persist &&
		navigator.storage.persisted
	) {
		let persisted = await navigator.storage.persisted();

		// If possible to get persistent storage without prompting the user, do it!
		if (!persisted) {
			try {
				if (navigator.permissions && navigator.permissions.query) {
					const permission = await navigator.permissions.query({
						name: "persistent-storage",
					});

					if (permission.state === "granted") {
						persisted = await navigator.storage.persist();
					}
				}
			} catch (error) {
				// Old browsers might error if they don't recognize the "persistent-storage" permission, but who cares
				console.error(error);
			}
		}

		// If still not persisted, notify user with some probabilitiy
		if (!persisted && Math.random() < 0.1) {
			logEvent({
				extraClass: "",
				persistent: true,
				saveToDb: false,
				htmlIsSafe: true,
				text: `<b>Persistent Storage</b><div class="mt-2"><div>Game data in your browser profile, so <a href="https://basketball-gm.com/manual/faq/#missing-leagues">sometimes it can be inadvertently deleted</a>. Enabling persistent storage helps protect against this.</div><button class="btn btn-primary mt-2" onclick="navigator.storage.persist().then((result) => { this.parentElement.innerHTML = (result ? 'Success!' : 'Failed to enable persistent storage!') + ' You can always view your persistent storage settings by going to Tools > Global Settings.'; })">Enable Persistent Storage</button></div>`,
				type: "info",
			});
		}
	}

	return {
		updateEvents: ["playerMovement"],
	};
};

export default newPhaseRegularSeason;
