on.input.in = function() {
  input.db.count(input.in, function(err, newDoc) {
    if(err) {
      output({error: err});
    } else {
      output({out: newDoc});
    }
  });
};
