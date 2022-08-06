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
        * [ViewDBTimeStampPlugin](#viewdbtimestampplugin)
        * [ViewDBVersioningPlugin](#viewdbversioningplugin)
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
  userCollection.find({ name: 'Jeff' }, (err, users) => {
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
userCollection.find({ name: 'Jeff' }, (err, users) => {
  if (err ?? users.length === 0) {
    return;
  }

  processUsers(users);
});
```

#### Plugins

ViewDB can be extended by plugins to intercept data manipulation. Two plugins are included in this repository:

* ViewDBTimeStampPlugin
* ViewDBVersioningPlugin

##### ViewDBTimeStampPlugin

Intercepts the `save`, `insert` & `findAndModify` Collection methods with timestamps for creation and latest update. The time inserted is a unix timestamp in milliseconds. It provides the following changes.

When _inserting_ documents without providing a `skipTimestamp` option, the inserted documents will get a `createDateTime` and a `changeDateTime` property will be added to the documents.

When _saving_ documents without providing a `skipTimestamp` option, the inserted documents will get an updated `changeDateTime` and a `changeDateTime` value. If there is no `createDateTime` property on the document, it will be added as well.

When _finding and modifying_ an existing document, the `changeDateTime` value will be update to the current time.

##### ViewDBVersioningPlugin

Intercepts the `save`, `insert` & `findAndModify` Collection methods with an incremented version, unless the `skipVersioning` option is passed and set to `true`.

Note that when _finding and modifying_ existing documents, if `version` is explicitly set in the `update` query, that value will be replaced with the incremented version.

### Store

Responsible for retrieving a Collection of documents. If the store needs some setup to be ready, it shall provide an `open` method to that.

#### Store Methods

<h5 id="store-collection">collection</h5>

Get a Collection in the Store matching the provided name.

##### open

Establish a connection to the persistence store.

#### InMemoryStore

A basic implementation of a Store, which keeps a record of the [in memory collections](#InMemoryCollection) by name in memory.

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

Retrieve a list of documents from the collection matching the query, and update the resulting documents based on the update query.

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

#### Cursor Methods

##### count

Get the amount of matches for the cursor.

##### forEach

Iterate through the matched documents and run the callback for each document.

##### limit

Limit the amount of documents to be retrieved.

##### observe

Retrieves an Observer listening for changes for the documents matched in the Cursor.

##### skip

Amounts of documents in the Cursor that should be skipped.

##### sort

Sort the resulting documents based on a query.

##### toArray

Retrieve the list of documents matching the query.

### Observer

Observe changes to documents for a Cursor.

#### Observer Methods

##### stop

Stop listening to changes matching the query.

### Merger

Check the provided data and provide information about how the values have changed.
