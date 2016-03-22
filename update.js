module.exports = {
  name: "update",
  ns: "nedb",
  description: "Update documents within the database",
  phrases: {
    active: "Updating document(s)"
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
      update: {
        title: "Query",
        description: "specifies how the documents should be modified. It is either a new document or a set of modifiers",
        type: "object"
      },
      options: {
        title: "Options",
        type: "object",
        properties: {
          multi: {
            title: "Multi",
            description: "allows the modification of several documents if set to true",
            type: "boolean",
            "default": false
          },
          upsert: {
            title: "Upsert",
            description: "if you want to insert a new document corresponding to the update rules if your query doesn't match anything. If your update is a simple object with no modifiers, it is the inserted document. In the other case, the query is stripped from all operator recursively, and the update is applied to it.",
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
      numReplaced: {
        title: "Replaced",
        type: "number"
      },
      error: {
        title: "Error",
        type: "Error"
      }
    }
  },
  fn: function update(input, $, output, state, done, cb, on) {
    var r = function() {
      $.db.update($.query, $.update, $.options,
        function(err, numReplaced, newDoc) {
          if (err) {
            output({
              error: $.create(err)
            });
          } else {
            output({
              out: $.create(newDoc),
              numReplaced: $.create(numReplaced)
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