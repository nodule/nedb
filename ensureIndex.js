module.exports = {
  name: "ensureIndex",
  ns: "nedb",
  description: "Create index",
  phrases: {
    active: "Creating index"
  },
  ports: {
    input: {
      db: {
        title: "Database",
        type: "Datastore"
      },
      options: {
        title: "Options",
        type: "object",
        properties: {
          fieldName: {
            title: "Fieldname",
            description: "name of the field to index. Use the dot notation to index a field in a nested document.",
            type: "string"
          },
          unique: {
            title: "Unique",
            description: "Enforce field uniqueness. Note that a unique index will raise an error if you try to index two documents for which the field is not defined.",
            type: "boolean",
            "default": false
          },
          sparse: {
            title: "Sparse",
            description: "Don't index documents for which the field is not defined. Use this option along with `unique` if you want to accept multiple documents for which it is not defined.",
            type: "boolean",
            "default": false
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
  fn: function ensureIndex(input, $, output, state, done, cb, on) {
    var r = function() {
      $.db.ensureIndex($.options,
        function(err) {
          if (err) {
            output({
              error: $.create(err)
            });
          } else {
            output({
              db: $.get('db')
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