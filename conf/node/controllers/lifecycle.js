import { readdir, rm } from "node:fs/promises";

/**
 * Clean up the snapshot folder
 *
 * This function will delete snapshots older than 7 days.
 * This allows a window for debugging and investigation.
 * Note: Succesfull snapshots are deleted immediately after being uploaded to S3.
 *
 * @param {string} path - The path to the snapshots folder
 * @returns {Promise<void>}
 */

export const deleteOldSnapshots = async (path =  `/tmp/snapshots`) => {
  const agencies = await readdir(path);

  for (const agency of agencies) {
    const agencyPath = `${path}/${agency}`;
    const snapshots = await readdir(agencyPath);

    for (const snapshot of snapshots) {
      const snapshotDate = new Date(snapshot);
      const today = new Date();
      const diff = today.valueOf() - snapshotDate.valueOf();
      const daysOld = diff / (1000 * 60 * 60 * 24);

      if (daysOld > 7) {
        await rm(`${agencyPath}/${snapshot}`, { recursive: true, force: true });
      }
    }
  }
};
