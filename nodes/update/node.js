output = function() {
  input.db.update(input.query, input.update, input.options,
    function(err, numReplaced, newDoc) {
    if(err) {
      output({error: err});
    } else {
      output({out: newDoc, numReplaced: numReplaced});
    }
  });
};
