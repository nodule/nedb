module.exports = {
  name: "findOne",
  ns: "nedb",
  description: "Find document within the database",
  async: true,
  phrases: {
    active: "Finding document"
  },
  ports: {
    input: {
      db: {
        title: "Database",
        type: "Datastore"
      },
      "in": {
        title: "Document",
        type: "object",
        async: true,
        fn: function __IN__(data, x, source, state, input, output) {
          var r = function() {
            input.db.findOne(data, function(err, newDoc) {
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