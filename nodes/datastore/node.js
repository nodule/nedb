output = function() {
  var db = new nedb(input.options);
  db.loadDatabase(function(err) {
    if (err) {
      output({error: err});
    } else {
      output({db: db});
    }
  });
};
