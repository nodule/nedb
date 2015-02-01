module.exports = {
  name: "datastore",
  ns: "nedb",
  description: "Nedb Datastore",
  phrases: {
    active: "Creating datastore"
  },
  dependencies: {
    npm: {
      nedb: require('nedb')
    }
  },
  ports: {
    input: {
      options: {
        title: "Options",
        type: "object",
        required: false,
        properties: {
          filename: {
            type: "string",
            description: "path to the file where the data is persisted. If left blank, the datastore is automatically considered in-memory only. It cannot end with a ~ which is used in the temporary files NeDB uses to perform crash-safe writes",
            required: false
          },
          inMemoryOnly: {
            Title: "In Memory only",
            type: "boolean",
            description: "In Memory Only",
            "default": false
          },
          onload: {
            title: "Onload",
            type: "function",
            description: "if you use autoloading, this is the handler called after the loadDatabase. It takes one error argument. If you use autoloading without specifying this handler, and an error happens during load, an error will be thrown.",
            required: false
          },
          afterSerialization: {
            title: "After serialization",
            type: "function",
            description: "hook you can use to transform data after it was serialized and before it is written to disk. Can be used for example to encrypt data before writing database to disk. This function takes a string as parameter (one line of an NeDB data file) and outputs the transformed string, which must absolutely not contain a \n character (or data will be lost)",
            required: false
          },
          beforeDeserialization: {
            title: "Before Deserialization",
            type: "function",
            description: "reverse of afterSerialization. Make sure to include both and not just one or you risk data loss. For the same reason, make sure both functions are inverses of one another. Some failsafe mechanisms are in place to prevent data loss if you misuse the serialization hooks: NeDB checks that never one is declared without the other, and checks that they are reverse of one another by testing on random strings of various lengths. In addition, if too much data is detected as corrupt, NeDB will refuse to start as it could mean you're not using the deserialization hook corresponding to the serialization hook used before (see below)",
            required: false
          },
          corruptAlertThreshold: {
            type: "number",
            description: "between 0 and 1, defaults to 10%. NeDB will refuse to start if more than this percentage of the datafile is corrupt. 0 means you don't tolerate any corruption, 1 means you don't care",
            minValue: 0,
            maxValue: 1,
            required: false
          }
        }
      }
    },
    output: {
      db: {
        title: "Database",
        type: "Datastore"
      },
      error: {
        title: "Error",
        type: "Error"
      }
    }
  },
  fn: function datastore(input, output, state, done, cb, on, nedb) {
    var r = function() {
      var db = new nedb(input.options);
      db.loadDatabase(function(err) {
        if (err) {
          output({
            error: err
          });
        } else {
          output({
            db: db
          });
        }
      });
    }.call(this);
    return {
      output: output,
      state: state,
      on: on,
      return: r
    };
  }
}