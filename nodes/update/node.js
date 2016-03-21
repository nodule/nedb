output = function() {
  $.db.update($.query, $.update, $.options,
    function(err, numReplaced, newDoc) {
    if(err) {
      output({error: err});
    } else {
      output({out: newDoc, numReplaced: numReplaced});
    }
  });
};
