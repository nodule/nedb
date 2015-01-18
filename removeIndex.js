module.exports = {
  name: "removeIndex",
  ns: "nedb",
  description: "Removing index",
  phrases: {
    active: "Removing index"
  },
  ports: {
    input: {
      db: {
        title: "Database",
        type: "Datastore"
      },
      fieldName: {
        title: "Fieldname",
        description: "name of the field",
        type: "string"
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
  fn: function removeIndex(input, output, state, done, cb, on) {
    var r = function() {
      input.db.removeIndex(input.fieldName,
        function(err) {
          if (err) {
            output({
              error: err
            });
          } else {
            output({
              db: input.db
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