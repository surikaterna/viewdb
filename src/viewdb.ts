import InMemoryStore from './inmemory/store';

export class ViewDB {
	_store: any;

	constructor(store?: any) {
		this._store = store || new InMemoryStore();
	}

	open = () => {
		if(this._store.open) {
			return this._store.open().then(() => this);
		}
		else {
			return Promise.resolve(this);
		}
	};

	collection = (collectionName: any, callback: any) =>  this._store.collection(collectionName, callback);
}

export default ViewDB;
