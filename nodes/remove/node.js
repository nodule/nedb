output = function() {
  $.db.remove($.query, $.options,
    function(err, numRemoved, newDoc) {
    if(err) {
      output({error: err});
    } else {
      output({out: newDoc, numRemoved: numRemoved});
    }
  });
};
