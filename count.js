module.exports = {
  name: "count",
  ns: "nedb",
  description: "Count documents within the database",
  async: true,
  phrases: {
    active: "Counting document(s)"
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
        fn: function __IN__(data, source, state, input, $, output) {
          var r = function() {
            $.db.count($.in, function(err, newDoc) {
              if (err) {
                output({
                  error: $.create(err)
                });
              } else {
                output({
                  out: $.create(newDoc)
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
        title: "Count",
        type: "integer"
      },
      error: {
        title: "Error",
        type: "Error"
      }
    }
  },
  state: {}
}