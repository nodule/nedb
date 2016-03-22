module.exports = {
  name: "remove",
  ns: "nedb",
  description: "Remove documents from database",
  phrases: {
    active: "Removing document(s)"
  },
  ports: {
    input: {
      db: {
        title: "Database",
        type: "Datastore"
      },
      query: {
        title: "Query",
        type: "object"
      },
      options: {
        title: "Options",
        type: "object",
        properties: {
          multi: {
            title: "Multi",
            description: "allows the removal of multiple documents if set to true",
            type: "boolean",
            "default": false
          }
        }
      }
    },
    output: {
      out: {
        title: "New Document",
        type: "object"
      },
      numRemoved: {
        title: "Removed",
        type: "number"
      },
      error: {
        title: "Error",
        type: "Error"
      }
    }
  },
  fn: function remove(input, $, output, state, done, cb, on) {
    var r = function() {
      $.db.remove($.query, $.options,
        function(err, numRemoved, newDoc) {
          if (err) {
            output({
              error: $.create(err)
            });
          } else {
            output({
              out: $.create(newDoc),
              numRemoved: $.create(numRemoved)
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