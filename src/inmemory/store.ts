import  Collection from './collection';

export class Store {
	_collections: any;

	constructor() {
		this._collections = {};
	}

	collection = (collectionName: any, callback?: any) => {
		var coll = this._collections[collectionName];
		if(coll === undefined) {
			coll = new Collection(collectionName);
			this._collections[collectionName] = coll;
		}
		if(callback) {
			callback(coll);
		}
		return coll;
	};
}

export default Store;
