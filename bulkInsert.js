module.exports = {
  name: "bulkInsert",
  ns: "nedb",
  description: "Insert multiple documents into the database",
  async: true,
  phrases: {
    active: "Inserting documents"
  },
  ports: {
    input: {
      db: {
        title: "Database",
        type: "Datastore"
      },
      "in": {
        title: "Document",
        type: "array",
        items: {
          type: "object"
        },
        async: true,
        fn: function __IN__(data, x, source, state, input, output) {
          var r = function() {
            input.db.insert(data, function(err, newDoc) {
              if (err) {
                output({
                  error: err
                });
              } else {
                output({
                  out: newDoc
                });
              }
            });
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      }
    },
    output: {
      out: {
        title: "New Document",
        type: "object"
      },
      error: {
        title: "Error",
        type: "Error"
      }
    }
  },
  state: {}
}