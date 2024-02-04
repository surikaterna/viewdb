ViewDB
======

[ViewDB](https://github.com/surikaterna/viewdb) is an database facade for JavaScript. It can be configured with a custom
Store in order to provide support for different persistence sources, such as MongoDB or IndexedDB, but comes with
a default in-memory Store for easy testing.

* [Purpose](#purpose)
* [Installation](#installation)
* [Usage](#usage-example)
* [Components](#components)
  * [ViewDB](#viewdb-1)
    * [Methods](#methods)
      * [open](#open)
      * [collection](#collection)
    * [Plugins](#plugins)
      * [TimeStampPlugin](#timestampplugin)
      * [VersioningPlugin](#versioningplugin)
  * [Store](#store)
    * [Methods](#methods-1)
      * [open](#open-1)
      * [collection](#collection-1)
    * [InMemoryStore](#inmemorystore)
  * [Collection](#collection-2)
    * [Methods](#methods-2)
      * [count](#count)
      * [createIndex](#createindex)
      * [drop](#drop)
      * [ensureIndex](#ensureindex)
      * [find](#find)
      * [findAndModify](#findandmodify)
      * [insert](#insert)
      * [remove](#remove)
      * [save](#save)
    * [InMemoryCollection](#inmemorycollection)
  * [Cursor](#cursor)
    * [Methods](#methods-3)
      * [count](#count-1)
      * [forEach](#foreach)
      * [limit](#limit)
      * [observe](#observe)
      * [skip](#skip)
      * [sort](#sort)
      * [toArray](#toarray)
  * [Observer](#observer)
    * [Methods](#methods-4)
      * [stop](#stop)
  * [Merger](#merger)

## Purpose

Provide a MongoDB like syntax for managing documents while providing customization for where to store the data.

## Installation

```shell
npm install viewdb
```

## Usage Example

### In-Memory Database

Create a ViewDB instance keeping data in memory.

```js
import ViewDB from 'viewdb';
import { processUsers, User, usersData } from './users';

const viewDB = new ViewDB();
const userCollection = viewDB.collection('user');
userCollection.insert(usersData, () => {
  userCollection.find({ name: 'Jeff' }, (err, users) => {
    if (err ?? users.length === 0) {
      return;
    }

    processUsers(users);
  });
});
```

## Components

### ViewDB

The database facade that manages a persistence [Store](#store). Manages [Collections](#collection-1) through the Store.

#### Methods

##### open

```js
// Use a MongoDB Store for persistence
const viewDB = new ViewDB(mongoDBStore);
// Make sure the Store is open and ready to use
await viewDB.open();
```

##### collection

Get a [Collection](#collection-1) from the provided [Store](#store). Will create and return a new Collection if one
doesn't already exist.

```js
const userCollection = viewDB.collection('user');
userCollection.find({ name: 'Jeff' }, (err, users) => {
  if (err ?? users.length === 0) {
    return;
  }

  processUsers(users);
});
```

#### Plugins

ViewDB can be extended by plugins to intercept data manipulation. Two plugins are included in this repository:

* [TimeStampPlugin](#timestampplugin)
* [VersioningPlugin](#versioningplugin)

##### TimeStampPlugin

Intercepts the `save`, `insert` & `findAndModify` _Collection_ methods with timestamps for creation and latest update.
The time inserted is a unix timestamp in milliseconds. It provides the following changes.

When _inserting_ documents without providing a `skipTimestamp` option, the inserted documents will get
a `createDateTime` and a `changeDateTime` property will be added to the documents.

When _saving_ documents without providing a `skipTimestamp` option, the inserted documents will get an
updated `changeDateTime` and a `changeDateTime` value. If there is no `createDateTime` property on the document, it will
be added as well.

When _finding and modifying_ an existing document, the `changeDateTime` value will be update to the current time.

```js
const viewDB = new ViewDB();

// Apply the plugin to the ViewDB Store
new TimeStampPlugin(viewDB);

const collection = viewDB.collection('user');

// User data for Jeff will get `createDateTime` and `changeDateTime` properties
await collection.insert({ name: 'Jeff' });
```

##### VersioningPlugin

Intercepts the `save`, `insert` & `findAndModify` _Collection_ methods with an incremented version, unless
the `skipVersioning` option is passed and set to `true`.

Note that when _finding and modifying_ existing documents, if `version` is explicitly set in the `update` query, that
value will be replaced with the incremented version.

```js
const viewDB = new ViewDB();

// Apply the plugin to the ViewDB Store
new VersioningPlugin(viewDB);

const collection = viewDB.collection('user');

// User data for Jeff will get a `version` property
await collection.insert({ name: 'Jeff' });
```

### Store

Responsible for retrieving a [Collection](#collection-2) of documents. If the store needs some setup to be ready, it
shall provide an `open` method for that.

Used through the [ViewDB](#viewdb-1) methods.

#### Methods

##### open

Optional method on the Store, to prepare the Store for usage.

```js
await store.open();
```

##### collection

Returns a named [Collection](#collection-2), kept in the Store for multiple retrievals.

```js
const userCollection = store.collection('user');

// Same instance of the collection retrieved above
const userCollectionRetrievedLater = store.collection('user');
```

#### InMemoryStore

A basic implementation of a Store, which keeps a record of the [in memory collections](#InMemoryCollection) by name in
memory. Used if no Store is provided as an argument to the ViewDB constructor.

### Collection

Responsible for managing the data.

#### Methods

##### count

Retrieve the current amount of documents in the collection.

```js
collection.count((err, count) => {
});
```

##### createIndex

Creates an `index` to be used when looking up data.

```js
collection.createIndex({ 'contactMeans.identifier': 1 }, null, (err, result) => {
});
```

##### drop

Clear all data in the collection.

```js
// Whether the collection was successfully dropped
const isSuccess = collection.drop();
```

##### ensureIndex

Creates an `index` for the collection unless it already exists.

```js
collection.ensureIndex({ 'contactMeans.identifier': 1 }, null, (err, result) => {
});
```

##### find

Returns a [Cursor](#cursor) for the list of documents from the collection matching the query.

```js
await cursor = collection.find({});
```

##### findAndModify

Retrieve a list of documents from the collection matching the query, and update the resulting documents based on the
update query.

```js
collection.findAndModify(query, null, update, options, (err, res) => {
});
```

##### insert

Insert new documents into the collection.

```js
collection.insert(newDocs, (err, insertedDocs) => {
});
```

##### remove

Remove documents matching the query from the collection.

```js
collection.remove({ name: 'Jeff' }, null, (err, result) => {
});
```

##### save

Replace the documents in the collection matching the provided documents by `_id`.

```js
collection.save(updatedDocs, (err, savedDocs) => {
});
```

#### InMemoryCollection

A basic implementation of a [Collection](#collection-2) managing the data in memory.

### Cursor

A result set of the queried [Collection](#collection-2). Contains methods to operate on the result set.

Used through the [Collection.find](#find) method, but a Cursor can be constructed manually.

```js
const collection = viewDB.collection('user');
const queryObj = { query: {} };
const cursorOptions = null;
const getDocuments = (query, callback) => {
  // Logic for retreving documents based on query and passing them to the callback
};

const cursor = new Cursor(collection, queryObj, cursorOptions, getDocuments);
```

#### Methods

##### count

Get the amount of matches for the [Cursor](#cursor).

```js
cursor.count((err, count) => {
});
```

##### forEach

Iterate through the matched documents and run the callback for each document.

```js
cursor.forEach((doc) => {
});
```

##### limit

Limit the amount of documents to be retrieved.

```js
// Get maximum 5 documents
cursor.limit(5).toArray((err, docs) => {
});
```

##### observe

Retrieves an [Observer](#observer) listening for changes for the documents matched in the [Cursor](#cursor).

```js
const observeOptions = {
  added: (user, index) => {
    // Called when a user matching the cursor has been inserted to the collection
  },
  changed: (currentUser, newUser, index) => {
    // Called when a user matching the cursor has been updated in the collection
  },
  moved: (user, oldIndex, newIndex) => {
    // Called when a user matching the cursor has been moved to another position
  },
  removed: (user, index) => {
    // Called when a user matching the cursor has been removed from the collection
  }
};

const observer = cursor.observe(observeOptions);
```

##### skip

Amounts of documents in the [Cursor](#cursor) that should be skipped.

```js
// Get documents starting from the 6th match
cursor.skip(5).toArray((err, docs) => {
});
```

##### sort

Sort the resulting documents based on a query.

```js
// Get documents sorted by creation time in descending order
cursor.sort({ createDateTime: -1 }).toArray((err, docs) => {
});
```

##### toArray

Retrieve the list of documents matching the query.

```js
cursor.toArray((err, docs) => {
});
```

### Observer

Observe changes to documents for a [Cursor](#cursor). With provide information about initial data, added, changed,
moved & removed data.

Used through the [Collection.observe](#observe) method, but an Observer can be constructed manually.

```js
const observer = new Observe(query, cursorOptions, collection, observerOptions);
```

#### Methods

##### stop

Stop listening to changes matching the query.

```js
const observer = collection.find({}).observe(observeOptions);
observer.stop();
```

### Merger

Check the provided data and provide information about how the values have changed.
