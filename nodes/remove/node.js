output = function() {
  input.db.remove(input.query, input.options,
    function(err, numRemoved, newDoc) {
    if(err) {
      output({error: err});
    } else {
      output({out: newDoc, numRemoved: numRemoved});
    }
  });
};
