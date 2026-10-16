const { projectDocument } = require('../../../viewdb_persistence_store_mongodb/dist/utils');

// Core's in-memory cursor stores projection options but does not apply them.
// Use the repository's Mongo projection implementation for these transport tests.
module.exports = function projectedCollection(viewdb, name) {
  const collection = viewdb.collection(name);
  const getDocuments = collection._getDocuments.bind(collection);
  collection._getDocuments = function (query, callback) {
    getDocuments(query, (error, documents) => {
      if (error || !query.project) return callback(error, documents);
      const project = { ...query.project };
      delete project._id;
      callback(
        null,
        documents.map((document) => {
          const projected = Object.keys(project).length ? projectDocument(document, project) : { ...document };
          // Mongo treats _id exclusion independently of ordinary inclusion fields.
          if (query.project._id === 0) delete projected._id;
          else projected._id = document._id;
          return projected;
        })
      );
    });
  };
  return collection;
};
