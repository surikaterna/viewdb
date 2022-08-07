ViewDB
======

[ViewDB](https://github.com/surikaterna/viewdb) is an ODM for TypeScript & JavaScript. It can be configured with a
custom Store in order to provide support for different persistence sources, such as MongoDB or IndexedDB, but comes with
a default in memory Store for easy testing.

* [Purpose](#purpose)
* [Installation](#installation)
* [Usage](#usage-example)
* [Components](#components)
    * [ViewDB](#viewdb-1)
        * [Plugins](#plugins)
            * [TimeStampPlugin](#timestampplugin)
            * [VersioningPlugin](#versioningplugin)
    * [Store](#store)
        * [Store Methods](#store-methods)
            * [collection](#collection)
        * [InMemoryStore](#inmemorystore)
    * [Collection](#collection-1)
        * [Collection Methods](#collection-methods)
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
        * [Cursor Methods](#cursor-methods)
            * [count](#count-1)
            * [forEach](#foreach)
            * [limit](#limit)
            * [observe](#observe)
            * [skip](#skip)
            * [sort](#sort)
            * [toArray](#toarray)
    * [Observer](#observer)
        * [Observer Methods](#observer-methods)
            * [stop](#stop)
    * [Merger](#merger)

## Purpose

Provide a MongoDB like syntax for managing documents while providing customization for where to store the data.

## Installation

```shell
npm install viewdb
```

## Usage Example

### In Memory Database

Create a ViewDB instance keeping data in memory.

```typescript
import ViewDB from 'viewdb';
import { processUsers, User, usersData } from './users';

const viewDB = new ViewDB();
const userCollection = viewDB.collection<User>('user');
userCollection.insert(usersData, () => {
  userCollection.find({name: 'Jeff'}, (err, users) => {
    if (err ?? users.length === 0) {
      return;
    }

    processUsers(users);
  });
});
```

## Components

<h3 id="viewdb-component">ViewDB</h3>

The ODM database that manages a persistence Store. Manages Collections through the Store.

```typescript
// Use a MongoDB Store for persistence
const viewDB = new ViewDB(mongoDBStore);
// Make sure the Store is open and ready to use
await viewDB.open();

const userCollection = viewDB.collection<User>('user');
userCollection.find({name: 'Jeff'}, (err, users) => {
  if (err ?? users.length === 0) {
    return;
  }

  processUsers(users);
});
```

#### Plugins

ViewDB can be extended by plugins to intercept data manipulation. Two plugins are included in this repository:

* TimeStampPlugin
* VersioningPlugin

##### TimeStampPlugin

Intercepts the `save`, `insert` & `findAndModify` Collection methods with timestamps for creation and latest update. The
time inserted is a unix timestamp in milliseconds. It provides the following changes.

When _inserting_ documents without providing a `skipTimestamp` option, the inserted documents will get
a `createDateTime` and a `changeDateTime` property will be added to the documents.

When _saving_ documents without providing a `skipTimestamp` option, the inserted documents will get an
updated `changeDateTime` and a `changeDateTime` value. If there is no `createDateTime` property on the document, it will
be added as well.

When _finding and modifying_ an existing document, the `changeDateTime` value will be update to the current time.

```ts
const viewDB = new ViewDB();

// Apply the plugin to the ViewDB Store
new TimeStampPlugin(viewDB);

const collection = viewDB.collection<User>('user');

// User data for Jeff will get `createDateTime` and `changeDateTime` properties
await collection.insert({ name: 'Jeff' });
```

##### VersioningPlugin

Intercepts the `save`, `insert` & `findAndModify` Collection methods with an incremented version, unless
the `skipVersioning` option is passed and set to `true`.

Note that when _finding and modifying_ existing documents, if `version` is explicitly set in the `update` query, that
value will be replaced with the incremented version.

```ts
const viewDB = new ViewDB();

// Apply the plugin to the ViewDB Store
new VersioningPlugin(viewDB);

const collection = viewDB.collection<User>('user');

// User data for Jeff will get a `version` property
await collection.insert({ name: 'Jeff' });
```

### Store

Responsible for retrieving a Collection of documents. If the store needs some setup to be ready, it shall provide
an `open` method to that.

#### Store Methods

<h5 id="store-collection">collection</h5>

Get a Collection in the Store matching the provided name.

##### open

Establish a connection to the persistence store.

#### InMemoryStore

A basic implementation of a Store, which keeps a record of the [in memory collections](#InMemoryCollection) by name in
memory.

### Collection

Responsible for managing the data.

#### Collection Methods

##### count

Retrieve the current amount of documents in the collection.

##### createIndex

Creates an `index` to be used when looking up data.

##### drop

Clear all data in the collection.

##### ensureIndex

Creates an `index` for the collection unless it already exists.

##### find

Retrieve a list of documents from the collection matching the query.

##### findAndModify

Retrieve a list of documents from the collection matching the query, and update the resulting documents based on the
update query.

##### insert

Insert new documents into the collection.

##### remove

Remove documents matching the query from the collection.

##### save

Replace the documents in the collection matching the provided documents by `_id`.

#### InMemoryCollection

A basic implementation of a Collection managing the data in memory.

### Cursor

A result set of the queried Collection. Contains methods to operate on the result set.

Used through the [Collection.find](#find) method, but a Cursor can be constructed manually.

```ts
const collection = viewDB.collection<User>('user');
const queryObj = {
  query: {}
};
const cursorOptions = null;
const getDocuments = (query: QueryObject, callback: GetDocumentsCallback<User>): void => {
  // Logic for retreving documents based on query and passing them to the callback
};

const cursor = new Cursor<User>(collection, queryObj, cursorOptions, getDocuments);
```

#### Cursor Methods

##### count

Get the amount of matches for the cursor.

```ts
// Promise API
await count = collection.find({}).count();

// Callback API
collection.find({}).count((err, count) => {
});
```

##### forEach

Iterate through the matched documents and run the callback for each document.

```ts
await count = collection.find({}).forEach((doc) => {
});
```

##### limit

Limit the amount of documents to be retrieved.

```ts
// Get maximum 5 documents
await docs = collection.find({}).limit(5).toArray();
```

##### observe

Retrieves an Observer listening for changes for the documents matched in the Cursor.

```ts
const observeOptions: ObserverOptions<User> = {
  added: (user: User, index: number): void => {
    // Called when a user matching the cursor has been inserted to the collection
  },
  changed: (currentUser: User, newUser: User, index: number): void => {
    // Called when a user matching the cursor has been updated in the collection
  },
  moved: (user: User, oldIndex: number, newIndex: number): void => {
    // Called when a user matching the cursor has been moved to another position
  },
  removed: (user: User, index: number): void => {
    // Called when a user matching the cursor has been removed from the collection
  }
};

const observer = collection.find({}).observe(observeOptions);
```

##### skip

Amounts of documents in the Cursor that should be skipped.

```ts
// Get documents starting from the 6th match
await docs = collection.find({}).skip(5).toArray();
```

##### sort

Sort the resulting documents based on a query.

```ts
// Get documents sorted by creation time in descending order
await docs = collection.find({}).sort({createDateTime: -1}).toArray();
```

##### toArray

Retrieve the list of documents matching the query.

```ts
// Promise API
await docs = collection.find({}).toArray();

// Callback API
collection.find({}).find((err, docs) => {
});
```

### Observer

Observe changes to documents for a Cursor. With provide information about initial data, added, changed, moved & removed
data.

Used through the [Collection.observe](#observe) method, but an Observer can be constructed manually.

```ts
const observer = new Observe<User>(query, cursorOptions, collection, observerOptions);
```

#### Observer Methods

##### stop

Stop listening to changes matching the query.

```ts
const observer = collection.find({}).observe(observeOptions);
observer.stop();
```

### Merger

Check the provided data and provide information about how the values have changed.
