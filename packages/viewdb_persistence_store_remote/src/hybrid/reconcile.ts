import _ from "lodash";

interface VersionedDoc {
  _id: string;
  _version?: number;
  [key: string]: any;
}

function reconcile<T extends VersionedDoc = VersionedDoc>(local: T[], remote: T[]): T[] {
  // Stupid merge logic
  // 0. Add the new docs to the result
  // 1. If has .version take one with highest version
  // 2. If no version prefer remote

  const localIds = _.map(local, "_id");
  const remoteIds = _.map(remote, "_id");

  const newIds = _.xor(localIds, remoteIds);
  const inBothIds = _.intersection(localIds, remoteIds);

  const alldocs = local.concat(remote);

  // add all new docs
  const result = _.filter(alldocs, (doc: T) => _.includes(newIds, doc._id));
  const localSame = _(local)
    .filter((doc: T) => _.includes(inBothIds, doc._id))
    .sortBy("_id")
    .value();
  const remoteSame = _(remote)
    .filter((doc: T) => _.includes(inBothIds, doc._id))
    .sortBy("_id")
    .value();

  // TODO; optimize so not a scan per id is needed
  _.forEach(localSame, (localDoc: T, n: number) => {
    const remoteDoc = remoteSame[n];

    if (!_.isUndefined(localDoc?.version) && !_.isUndefined(remoteDoc?.version)) {
      result.push(localDoc.version > remoteDoc.version ? localDoc : remoteDoc);
    } else if (remoteDoc) {
      result.push(remoteDoc);
    } else {
      //we found a duplicate in localDoc
      if (!_.isUndefined(localDoc?.version)) {
        const duplicateIndex = _.findIndex(result, (resultDoc: T) => resultDoc._id === localDoc?._id);

        // if localDoc is a later version, save it instead of old version (and always prefer objects with version property)
        if (!result[duplicateIndex].version || result[duplicateIndex].version < localDoc?.version) {
          result[duplicateIndex] = localDoc;
        }
      }
    }
  });
  return result;
}

export default reconcile;
