import { LoggerFactory } from "slf";

const LOG = LoggerFactory.getLogger("viewdb:lokijs:cordova-fs-adapter");

class LokiCordovaFSAdapterError extends Error {}

class LokiCordovaFSAdapter {
  deviceReady: any;
  location: any;
  options: any;
  constructor(options: any) {
    this.options = options;
    this.location = (window as any)?.cordova?.file?.externalDataDirectory;
    this.deviceReady = new Promise((resolve) => {
      document.addEventListener("deviceready", () => {
        resolve(true);
      });
    });
  }

  saveDatabase(dbname: any, dbstring: any, callback: any) {
    LOG.info("saving database");
    this._getFile(
      dbname,
      (fileEntry: any) => {
        fileEntry.createWriter(
          (fileWriter: any) => {
            fileWriter.onwriteend = () => {
              if (fileWriter.length === 0) {
                const blob = this._createBlob(dbstring, "text/plain");
                fileWriter.write(blob);
                LOG.info("saved database to %s", this.location);
                callback();
              }
            };
            fileWriter.truncate(0);
          },
          (err: any) => {
            LOG.error("error writing file ", err);
            throw new LokiCordovaFSAdapterError("Unable to write file" + JSON.stringify(err));
          }
        );
      },
      (err: any) => {
        LOG.error("error getting file", err);
        throw new LokiCordovaFSAdapterError("Unable to get file" + JSON.stringify(err));
      }
    );
  }

  loadDatabase(dbname: any, callback: any) {
    LOG.info("Loading database - waiting for device ready");
    this.deviceReady.then(() => {
      LOG.info("Loading database - device is ready - loading db file");
      this._getFile(
        dbname,
        (fileEntry: any) => {
          fileEntry.file(
            (file: any) => {
              LOG.info("Loaded file %j", file);
              const reader = new FileReader();
              reader.onloadend = (event) => {
                const contents = event?.target?.result;
                if ((contents as string).length === 0) {
                  LOG.warn("could not find database");
                  callback(null);
                } else {
                  LOG.info("Loaded database from %s", this.location);
                  callback(contents);
                }
              };
              reader.readAsText(file);
            },
            (err: any) => {
              LOG.error("error reading file", err);
              callback(new LokiCordovaFSAdapterError("Unable to read file" + err.message));
            }
          );
        },
        (err: any) => {
          LOG.error("error getting file", err);
          callback(new LokiCordovaFSAdapterError("Unable to get file: " + err.message));
        }
      );
    });
  }

  deleteDatabase(dbname: any, callback: any) {
    (window as any).resolveLocalFileSystemURL(
      this.location,
      (dir: any) => {
        const fileName = this.options.prefix + "__" + dbname;
        dir.getFile(
          fileName,
          { create: true },
          (fileEntry: any) => {
            fileEntry.remove(
              () => {
                callback();
              },
              (err: any) => {
                LOG.error("error delete file", err);
                throw new LokiCordovaFSAdapterError("Unable delete file" + JSON.stringify(err));
              }
            );
          },
          (err: any) => {
            LOG.error("error delete database", err);
            throw new LokiCordovaFSAdapterError("Unable delete database" + JSON.stringify(err));
          }
        );
      },
      (err: any) => {
        throw new LokiCordovaFSAdapterError("Unable to resolve local file system URL" + JSON.stringify(err));
      }
    );
  }

  _getFile(name: any, handleSuccess: any, handleError: any) {
    (window as any).resolveLocalFileSystemURL(
      this.location,
      (dir: any) => {
        const fileName = this.options.prefix + "__" + name;
        dir.getFile(fileName, { create: true }, handleSuccess, handleError);
      },
      (err: any) => {
        throw new LokiCordovaFSAdapterError("Unable to resolve local file system URL" + JSON.stringify(err));
      }
    );
  }

  // adapted from http://stackoverflow.com/questions/15293694/blob-constructor-browser-compatibility
  _createBlob(data: any, datatype: any) {
    let blob;

    try {
      blob = new Blob([data], { type: datatype });
    } catch (err: any) {
      (window as any).BlobBuilder =
        (window as any).BlobBuilder ||
        (window as any).WebKitBlobBuilder ||
        (window as any).MozBlobBuilder ||
        (window as any).MSBlobBuilder;

      if (err.name === "TypeError" && (window as any).BlobBuilder) {
        const bb = new (window as any).BlobBuilder();
        bb.append(data);
        blob = bb.getBlob(datatype);
      } else if (err.name === "InvalidStateError") {
        // InvalidStateError (tested on FF13 WinXP)
        blob = new Blob([data], { type: datatype });
      } else {
        // We're screwed, blob constructor unsupported entirely
        throw new LokiCordovaFSAdapterError("Unable to create blob" + JSON.stringify(err));
      }
    }
    return blob;
  }
}

export default LokiCordovaFSAdapter;
