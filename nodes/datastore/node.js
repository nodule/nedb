output = function() {
  var db = new nedb(input.options);
  db.loadDatabase(function(err) {
    if (err) {
      cb({error: err});
    } else {
      cb({db: db});
    }
  });
};
